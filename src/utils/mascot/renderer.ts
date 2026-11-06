import { Application, Assets, extensions } from "pixi.js";
import {
	type CubismInternalModel,
	Live2DModel,
	Live2DPlugin,
} from "untitled-pixi-live2d-engine/cubism";
import type {
	MascotModel,
	MascotParameter,
	MascotSize,
} from "@/types/mascotConfig";
import { createElainaGreeting, elainaGreetingMs } from "./elaina-greeting";

extensions.add(Live2DPlugin);

export interface MascotRenderer {
	resize(size: MascotSize): void;
	setPaused(paused: boolean): void;
	setReducedMotion(reduced: boolean): void;
	focus(x: number, y: number): void;
	setPose(pose: readonly MascotParameter[] | undefined, greet?: boolean): void;
	cancelGreeting(): void;
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
	let pose: readonly MascotParameter[] | undefined;
	let poseStartedAt = 0;
	let greetingStartedAt = Number.NEGATIVE_INFINITY;
	let greeting: ReturnType<typeof createElainaGreeting>;

	const releaseUrl = (objectUrl: string) => URL.revokeObjectURL(objectUrl);
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		greeting?.destroy();
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
	const loadGreeting = async (base: string): Promise<string | undefined> => {
		if (profile.greetingArt !== "elaina") return undefined;
		try {
			const paintingUrl = await fetchBlob("greeting-arm.webp", base);
			const painting = new Image();
			painting.src = paintingUrl;
			await painting.decode();
			return paintingUrl;
		} catch {
			// The base model and its expressions still work if the art is unavailable.
			return undefined;
		}
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
		const [moc, textures, physicsUrl, greetingUrl] = await Promise.all([
			fetchBlob(files.Moc, base),
			Promise.all(files.Textures.map((file) => fetchBlob(file, base))),
			files.Physics ? fetchBlob(files.Physics, base) : undefined,
			loadGreeting(base),
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
		if (greetingUrl) {
			const art = createElainaGreeting(app.canvas, raw.drawables, greetingUrl);
			if (art) {
				greeting = art;
				const draw = internal.draw.bind(internal);
				internal.draw = (gl) => {
					art.draw(performance.now() - greetingStartedAt, () => draw(gl));
				};
			}
		}
		internal.on("beforeModelUpdate", () => {
			if (reduced) {
				defaults.forEach((value, index) => {
					core.setParameterValueByIndex(index, value);
				});
			}
			if (!pose) return;
			const elapsed = performance.now() - poseStartedAt;
			for (const parameter of pose) {
				const index = indices.get(parameter.parameter);
				if (index === undefined) continue;
				if ("pulse" in parameter) {
					const { amplitude, durationMs } = parameter.pulse;
					if (!reduced && elapsed < durationMs) {
						const envelope = Math.sin((elapsed / durationMs) * Math.PI);
						core.addParameterValueByIndex(index, amplitude * envelope ** 2);
					}
					continue;
				}
				const { value, oscillation } = parameter;
				let offset = 0;
				if (!reduced && oscillation && elapsed < oscillation.durationMs) {
					const progress = elapsed / oscillation.durationMs;
					offset =
						oscillation.amplitude *
						Math.sin(progress * 4 * Math.PI) *
						(1 - progress);
				}
				core.setParameterValueByIndex(index, value + offset);
			}
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
			greeting?.resize(nextSize);
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
				if (value) greetingStartedAt = Number.NEGATIVE_INFINITY;
				internal.physics = value ? undefined : physics;
				internal.eyeBlink = value ? undefined : blink;
				if (value) internal.focusController.focus(0, 0, true);
				sync();
			},
			focus(x, y) {
				if (!destroyed && !paused && !reduced)
					internal.focusController.focus(x, y);
			},
			setPose(value, greet = false) {
				pose = value;
				poseStartedAt = performance.now();
				if (
					greet &&
					greeting &&
					!reduced &&
					poseStartedAt - greetingStartedAt >= elainaGreetingMs
				)
					greetingStartedAt = poseStartedAt;
				if (paused || reduced) renderOnce();
			},
			cancelGreeting() {
				greetingStartedAt = Number.NEGATIVE_INFINITY;
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
