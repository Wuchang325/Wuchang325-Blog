import { Application, Assets, extensions } from "pixi.js";
import {
	type CubismInternalModel,
	Live2DModel,
	Live2DPlugin,
} from "untitled-pixi-live2d-engine/cubism";
import type { MascotModel, MascotSize } from "@/types/mascotConfig";

extensions.add(Live2DPlugin);

export interface MascotRenderer {
	resize(size: MascotSize): void;
	setPaused(paused: boolean): void;
	setReducedMotion(reduced: boolean): void;
	focus(x: number, y: number): void;
	interact(): void;
	destroy(): void;
}

interface ModelJson {
	Version: number;
	FileReferences: { Moc: string; Textures: string[]; Physics?: string };
	url?: string;
}

/**
 * This module is loaded only after the device/storage gate AND Cubism Core.
 * Fetch model inputs ourselves so every network request is bounded/cancellable.
 * The engine reads local Blob URLs; disposing also evicts its texture cache.
 */
export async function createMascotRenderer(
	host: HTMLElement,
	profile: MascotModel,
	size: MascotSize,
	signal: AbortSignal,
	onFailure: (error: unknown) => void,
): Promise<MascotRenderer> {
	const attempt = new AbortController();
	const abort = () => attempt.abort(signal.reason);
	signal.addEventListener("abort", abort, { once: true });
	if (signal.aborted) abort();
	const timeout = window.setTimeout(
		() =>
			attempt.abort(new DOMException("Model load timed out", "TimeoutError")),
		12000,
	);
	const objectUrls: string[] = [];
	const textureUrls: string[] = [];
	const app = new Application();
	let model: Live2DModel | undefined;
	let destroyed = false;
	let paused = true;
	let reduced = false;
	let expressionIndex = -1;
	let nextExpression = 0;
	let expressionTimer: ReturnType<typeof setTimeout> | undefined;

	const releaseUrl = (objectUrl: string) => URL.revokeObjectURL(objectUrl);
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		clearTimeout(expressionTimer);
		if (model && !model.destroyed) model.destroy();
		if (app.renderer) app.destroy(true, { children: true });
		for (const objectUrl of objectUrls) {
			if (textureUrls.includes(objectUrl) && Assets.cache.has(objectUrl)) {
				void Assets.unload(objectUrl)
					.catch(() => {})
					.finally(() => releaseUrl(objectUrl));
			} else releaseUrl(objectUrl);
		}
	};
	const fetchBlob = async (asset: string, base: string) => {
		const response = await fetch(new URL(asset, base), {
			signal: attempt.signal,
		});
		if (!response.ok)
			throw new Error(`Model asset returned ${response.status}`);
		const blob = await response.blob();
		attempt.signal.throwIfAborted();
		const objectUrl = URL.createObjectURL(blob);
		objectUrls.push(objectUrl);
		return objectUrl;
	};

	try {
		attempt.signal.throwIfAborted();
		const response = await fetch(profile.modelUrl, { signal: attempt.signal });
		if (!response.ok)
			throw new Error(`Model settings returned ${response.status}`);
		const settings = (await response.json()) as ModelJson;
		const files = settings?.FileReferences;
		if (
			!files ||
			typeof files.Moc !== "string" ||
			!Array.isArray(files.Textures) ||
			!files.Textures.length ||
			files.Textures.some((item) => typeof item !== "string")
		) {
			throw new Error("Invalid model settings");
		}
		const base = response.url;
		const [moc, textures, physicsUrl] = await Promise.all([
			fetchBlob(files.Moc, base),
			Promise.all(files.Textures.map((file) => fetchBlob(file, base))),
			files.Physics ? fetchBlob(files.Physics, base) : undefined,
		]);
		textureUrls.push(...textures);
		settings.url = base;
		settings.FileReferences = {
			...files,
			Moc: moc,
			Textures: textures,
			...(physicsUrl ? { Physics: physicsUrl } : {}),
		};
		attempt.signal.throwIfAborted();
		await app.init({
			width:
				Math.ceil((size * profile.canvasWidth) / profile.canvasHeight) + 24,
			height: size + 16,
			preference: "webgl",
			backgroundAlpha: 0,
			antialias: true,
			resolution: Math.min(devicePixelRatio, 2),
			autoDensity: true,
			autoStart: false,
		});
		attempt.signal.throwIfAborted();
		const modelPromise = Live2DModel.from(settings, {
			autoUpdate: false,
			autoFocus: false,
			autoHitTest: false,
			breathDepth: 0.3,
			textureOptions: { lod: false },
		});
		// A canceled setup may finish later; it must never attach to the page.
		void modelPromise.then(
			(lateModel) => {
				if ((destroyed || attempt.signal.aborted) && !lateModel.destroyed)
					lateModel.destroy();
			},
			() => {},
		);
		let rejectAbort: () => void = () => {};
		const aborted = new Promise<never>((_, reject) => {
			rejectAbort = () => reject(attempt.signal.reason);
			attempt.signal.addEventListener("abort", rejectAbort, { once: true });
			if (attempt.signal.aborted) rejectAbort();
		});
		try {
			model = await Promise.race([modelPromise, aborted]);
		} finally {
			attempt.signal.removeEventListener("abort", rejectAbort);
		}
		attempt.signal.throwIfAborted();
		const avatar = model;
		const internal = avatar.internalModel as CubismInternalModel;
		const core = internal.coreModel;
		const raw = core.getModel();
		const indices = new Map(raw.parameters.ids.map((id, index) => [id, index]));
		const defaults = [...raw.parameters.defaultValues];
		const physics = internal.physics;
		const blink = internal.eyeBlink;
		avatar.anchor.set(0, 0);
		app.stage.addChild(avatar);
		app.canvas.setAttribute("aria-hidden", "true");
		app.canvas.addEventListener(
			"webglcontextlost",
			(event) => {
				event.preventDefault();
				if (!destroyed) onFailure(new Error("WebGL context lost"));
			},
			{ signal },
		);
		host.prepend(app.canvas);
		internal.on("beforeModelUpdate", () => {
			if (reduced) {
				defaults.forEach((value, index) => {
					core.setParameterValueByIndex(index, value);
				});
			}
			profile.expressions.forEach((expression, index) => {
				const parameter = indices.get(expression.parameter);
				if (parameter !== undefined)
					core.setParameterValueByIndex(
						parameter,
						index === expressionIndex ? expression.value : defaults[parameter],
					);
			});
		});
		app.ticker.maxFPS = 30;
		app.ticker.add((ticker) => avatar.update(Math.min(ticker.deltaMS, 50)));
		const renderOnce = () => {
			if (destroyed) return;
			// Zero delta skips parameter application in this engine.
			avatar.update(1);
			app.render();
		};
		const sync = () => {
			if (paused || reduced) {
				app.ticker.stop();
				renderOnce();
			} else app.ticker.start();
		};
		const resize = (nextSize: MascotSize) => {
			if (destroyed) return;
			const width =
				Math.ceil((nextSize * profile.canvasWidth) / profile.canvasHeight) + 24;
			app.renderer.resize(width, nextSize + 16);
			avatar.scale.set(nextSize / profile.canvasHeight);
			avatar.position.set(12, 16);
			renderOnce();
		};
		resize(size);
		return {
			resize,
			setPaused(value) {
				paused = value;
				sync();
			},
			setReducedMotion(value) {
				reduced = value;
				internal.physics = value ? undefined : physics;
				internal.eyeBlink = value ? undefined : blink;
				if (value) internal.focusController.focus(0, 0, true);
				sync();
			},
			focus(x, y) {
				if (!destroyed && !paused && !reduced)
					internal.focusController.focus(x, y);
			},
			interact() {
				if (destroyed || !profile.expressions.length) return;
				expressionIndex = nextExpression++ % profile.expressions.length;
				clearTimeout(expressionTimer);
				renderOnce();
				expressionTimer = setTimeout(() => {
					expressionIndex = -1;
					renderOnce();
				}, 2000);
			},
			destroy,
		};
	} catch (error) {
		attempt.abort(error);
		destroy();
		throw error;
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener("abort", abort);
	}
}
