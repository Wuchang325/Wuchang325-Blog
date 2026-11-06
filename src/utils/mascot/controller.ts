import type {
	MascotClientOptions,
	MascotParameter,
	MascotReaction,
	MascotSize,
} from "@/types/mascotConfig";
import { prefersReducedMotion } from "../motion";
import { loadScriptOnce } from "../script-loader";
import { mascotDialogue, mascotLabels } from "./labels";
import type { MascotRenderer } from "./renderer";
import { listenForWalineLikes } from "./waline-likes";

const sizes: MascotSize[] = [240, 280, 320];
const tapWindowMs = 1800;
const reactionDurationMs: Readonly<Record<MascotReaction, number>> = {
	tap: 2300,
	wink: 1500,
	shy: 2600,
	flustered: 2600,
	like: 2700,
};

function required<T extends HTMLElement>(
	root: HTMLElement,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing mascot element: ${selector}`);
	return element;
}

function mount(root: HTMLElement): () => void {
	const { userAgent, platform, maxTouchPoints } = navigator;
	const mobile =
		/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
		(platform === "MacIntel" && maxTouchPoints > 1);
	if (mobile) return () => {};

	const options = JSON.parse(
		root.dataset.options ?? "null",
	) as MascotClientOptions;
	const labels = mascotLabels(options.model.name);
	const stage = required(root, "[data-mascot-stage]");
	const tools = required(root, "[data-mascot-tools]");
	const message = required(root, "[data-mascot-message]");
	const status = required(root, "[data-mascot-status]");
	const dialogue = required(root, "[data-mascot-dialogue]");
	const button = (action: string) =>
		required<HTMLButtonElement>(root, `[data-mascot-action="${action}"]`);
	const restore = button("restore");
	const listeners = new AbortController();
	const media = matchMedia(
		`(min-width: ${options.minWidth}px) and (hover: hover) and (pointer: fine)`,
	);
	const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
	const storageKey = `shirone-mascot:${options.model.id}:v1`;
	let size = options.size;
	let collapsed = false;
	let disabled = false;
	try {
		const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
		if (saved?.collapsed === true) collapsed = true;
		if (saved?.disabled === true) disabled = true;
		if (sizes.includes(saved?.size)) size = saved.size;
	} catch {
		/* Storage is optional; private/restricted browsers remain usable. */
	}
	let renderer: MascotRenderer | undefined;
	let pending: AbortController | undefined;
	let cancelIdle: (() => void) | undefined;
	let generation = 0;
	let busy = false;
	let failed = false;
	let blocked = false;
	let disconnected = false;
	let focusWhenReady = false;
	let reconcileFrame = 0;
	let searchObserver: MutationObserver | undefined;
	let musicObserver: MutationObserver | undefined;
	let currentSearch: Element | null = null;
	let currentMusic: Element | null = null;
	let startOffset = 0;
	let reaction: MascotReaction | undefined;
	let reactionTimer: ReturnType<typeof setTimeout> | undefined;
	let legacyIndex = 0;
	let tapCount = 0;
	let lastTapAt = 0;

	const clearReaction = () => {
		if (reactionTimer === undefined) return;
		clearTimeout(reactionTimer);
		reactionTimer = undefined;
		reaction = undefined;
		dialogue.textContent = "";
		renderer?.setPose(undefined);
	};
	const resetInteraction = () => {
		tapCount = 0;
		renderer?.cancelGreeting();
		clearReaction();
	};
	const play = (pose: readonly MascotParameter[], next?: MascotReaction) => {
		clearTimeout(reactionTimer);
		reaction = next;
		renderer?.setPose(pose, next === "tap");
		dialogue.textContent = next ? mascotDialogue[next] : "";
		reactionTimer = setTimeout(
			clearReaction,
			next ? reactionDurationMs[next] : 2000,
		);
	};
	const canInteract = () => renderer && !root.hidden && !document.hidden;
	const interact = () => {
		if (!canInteract() || reaction === "like") return;
		const { reactions, expressions } = options.model;
		if (!reactions?.tap) {
			if (expressions?.length)
				play([expressions[legacyIndex++ % expressions.length]]);
			return;
		}
		const now = performance.now();
		tapCount = now - lastTapAt <= tapWindowMs ? Math.min(tapCount + 1, 5) : 1;
		lastTapAt = now;
		const next =
			tapCount >= 5 && reactions.flustered
				? "flustered"
				: tapCount >= 3 && reactions.shy
					? "shy"
					: tapCount >= 2 && reactions.wink
						? "wink"
						: "tap";
		const pose = reactions[next];
		if (pose && (next !== reaction || tapCount === 1)) play(pose, next);
	};

	const persist = () => {
		try {
			localStorage.setItem(
				storageKey,
				JSON.stringify({ collapsed, size, disabled }),
			);
		} catch {
			/* A denied storage write must not interrupt interaction. */
		}
	};
	const setSize = () => {
		root.style.setProperty(
			"--mascot-width",
			`${Math.ceil((size * options.model.canvasWidth) / options.model.canvasHeight) + 24}px`,
		);
		root.style.setProperty("--mascot-height", `${size + 16}px`);
		button("smaller").disabled = size === sizes[0] || !renderer;
		button("larger").disabled = size === sizes[sizes.length - 1] || !renderer;
	};
	const render = () => {
		root.dataset.settingLabel = media.matches ? labels.setting : "";
		root.dataset.preference = disabled ? "off" : "on";
		root.dataset.state = disabled
			? "disabled"
			: collapsed
				? "collapsed"
				: failed
					? "error"
					: renderer
						? "ready"
						: "loading";
		root.hidden = disabled || !media.matches || blocked;
		stage.hidden = collapsed || !renderer;
		tools.hidden = collapsed;
		message.hidden = collapsed || !!renderer;
		status.textContent = failed ? labels.failed : labels.loading;
		button("retry").hidden = !failed;
		restore.hidden = !collapsed;
		root.setAttribute("aria-busy", String(busy));
		setSize();
	};
	const stop = () => {
		generation++;
		cancelIdle?.();
		cancelIdle = undefined;
		pending?.abort();
		pending = undefined;
		renderer?.destroy();
		renderer = undefined;
		legacyIndex = 0;
		resetInteraction();
		busy = false;
		root.dataset.running = "false";
	};
	const queueReconcile = () => {
		if (!reconcileFrame && !disconnected)
			reconcileFrame = requestAnimationFrame(() => {
				reconcileFrame = 0;
				reconcile();
			});
	};
	const observeShell = () => {
		const search = document.querySelector("#search-panel");
		if (search !== currentSearch) {
			searchObserver?.disconnect();
			currentSearch = search;
			if (search) {
				searchObserver = new MutationObserver(queueReconcile);
				searchObserver.observe(search, {
					attributes: true,
					attributeFilter: ["class"],
				});
			}
		}
		const music = document.querySelector(".music-floating");
		if (music !== currentMusic) {
			musicObserver?.disconnect();
			currentMusic = music;
			if (music) {
				musicObserver = new MutationObserver(queueReconcile);
				musicObserver.observe(music, {
					attributes: true,
					attributeFilter: ["class", "style"],
				});
			}
		}
	};
	const obstructed = () => {
		if (
			document.querySelector(
				"dialog[open], .fancybox__container, #search-panel:not(.float-panel-closed)",
			)
		)
			return true;
		if (!media.matches) return false;
		const styles = getComputedStyle(root);
		const baseLeft =
			Number.parseFloat(styles.getPropertyValue("--m3e-space-4")) || 0;
		const width =
			Math.ceil(
				(size * options.model.canvasWidth) / options.model.canvasHeight,
			) + 24;
		const top = innerHeight - size - 16;
		const overlaps = (rect: DOMRect, left: number) =>
			rect.width > 0 &&
			rect.height > 0 &&
			rect.left < left + width &&
			rect.right > left &&
			rect.top < innerHeight &&
			rect.bottom > top;
		const handle = currentMusic?.querySelector(".music-floating__handle");
		const handleRect = handle?.checkVisibility()
			? handle.getBoundingClientRect()
			: undefined;
		const gap =
			Number.parseFloat(styles.getPropertyValue("--m3e-space-2")) || 0;
		const nextOffset =
			handleRect && overlaps(handleRect, baseLeft)
				? Math.ceil(handleRect.right + gap - baseLeft)
				: 0;
		if (nextOffset !== startOffset) {
			startOffset = nextOffset;
			root.style.setProperty("--mascot-start-offset", `${startOffset}px`);
		}
		const left = baseLeft + startOffset;
		return [
			...document.querySelectorAll<HTMLElement>(
				".music-floating--open .music-floating__panel, .m3-floating-controls-container--start",
			),
		].some(
			(element) =>
				element.checkVisibility() &&
				overlaps(element.getBoundingClientRect(), left),
		);
	};

	async function load(): Promise<void> {
		cancelIdle = undefined;
		if (
			disconnected ||
			disabled ||
			collapsed ||
			!media.matches ||
			blocked ||
			document.hidden
		)
			return;
		const token = ++generation;
		const attempt = new AbortController();
		pending = attempt;
		busy = true;
		render();
		const current = () =>
			token === generation &&
			!attempt.signal.aborted &&
			!disconnected &&
			root.isConnected &&
			!disabled &&
			!collapsed &&
			media.matches;
		try {
			await loadScriptOnce(options.coreUrl, 12000);
			if (!current() || blocked || document.hidden) return;
			const { createMascotRenderer } = await import("./renderer");
			if (!current() || blocked || document.hidden) return;
			const instance = await createMascotRenderer(
				stage,
				options.model,
				size,
				attempt.signal,
				(error) => {
					if (!current()) return;
					console.warn("Mascot rendering stopped", error);
					failed = true;
					stop();
					render();
				},
			);
			if (!current()) {
				instance.destroy();
				return;
			}
			renderer = instance;
			if (focusWhenReady) {
				focusWhenReady = false;
				render();
				button("interact").focus({ preventScroll: true });
			}
		} catch (error) {
			if (current()) {
				failed = true;
				console.warn("Mascot loading failed", error);
			}
		} finally {
			if (token === generation) {
				busy = false;
				pending = undefined;
				reconcile();
			}
		}
	}

	function reconcile(): void {
		if (disconnected) return;
		observeShell();
		blocked = obstructed();
		if (
			(disabled || !media.matches || collapsed) &&
			(renderer || pending || cancelIdle)
		)
			stop();
		if (disabled || !media.matches || collapsed || blocked || document.hidden) {
			cancelIdle?.();
			cancelIdle = undefined;
			resetInteraction();
			renderer?.setPaused(true);
			root.dataset.running = "false";
		} else if (renderer) {
			const reduced = prefersReducedMotion();
			renderer.setReducedMotion(reduced);
			renderer.setPaused(false);
			root.dataset.running = String(!reduced);
		} else if (!busy && !failed && !cancelIdle) {
			// Defer optional GPU work until after initial page work, with a bounded wait.
			if ("requestIdleCallback" in window) {
				const id = window.requestIdleCallback(() => void load(), {
					timeout: 1500,
				});
				cancelIdle = () => window.cancelIdleCallback(id);
			} else {
				const id = setTimeout(() => void load(), 400);
				cancelIdle = () => clearTimeout(id);
			}
		}
		render();
	}

	root.addEventListener(
		"shirone:mascot-preference",
		(event) => {
			if (
				!(event instanceof CustomEvent) ||
				typeof event.detail !== "boolean" ||
				!media.matches
			)
				return;
			disabled = !event.detail;
			if (!disabled) {
				collapsed = false;
				failed = false;
			}
			focusWhenReady = false;
			persist();
			reconcile();
		},
		{ signal: listeners.signal },
	);

	root.addEventListener(
		"click",
		(event) => {
			const target =
				event.target instanceof Element
					? event.target.closest<HTMLElement>("[data-mascot-action]")
					: null;
			switch (target?.dataset.mascotAction) {
				case "hide":
					collapsed = true;
					persist();
					stop();
					render();
					restore.focus({ preventScroll: true });
					break;
				case "restore":
					collapsed = false;
					failed = false;
					focusWhenReady = true;
					persist();
					reconcile();
					break;
				case "retry":
					failed = false;
					reconcile();
					break;
				case "interact":
					interact();
					break;
				case "smaller":
				case "larger": {
					const next =
						sizes[
							sizes.indexOf(size) +
								(target.dataset.mascotAction === "larger" ? 1 : -1)
						];
					if (next) {
						size = next;
						renderer?.resize(size);
						persist();
						reconcile();
						// Reaching an endpoint disables the focused size button.
						// Keep focus inside the mascot so the tools remain reachable
						// after their position moves with the resized character.
						if (target instanceof HTMLButtonElement && target.disabled)
							button("interact").focus({ preventScroll: true });
					}
					break;
				}
			}
		},
		{ signal: listeners.signal },
	);
	const likePose = options.model.reactions?.like;
	if (likePose)
		listenForWalineLikes(() => {
			if (!canInteract()) return;
			tapCount = 0;
			play(likePose, "like");
		}, listeners.signal);
	document.addEventListener("swup:content:replace", resetInteraction, {
		signal: listeners.signal,
	});
	document.addEventListener(
		"pointermove",
		(event) => {
			if (
				!renderer ||
				!options.followPointer ||
				root.hidden ||
				document.hidden ||
				prefersReducedMotion()
			)
				return;
			const rect = stage.getBoundingClientRect();
			const x = Math.max(
				-0.4,
				Math.min(
					0.4,
					(event.clientX - rect.left - rect.width / 2) / innerWidth,
				),
			);
			const y = Math.max(
				-0.25,
				Math.min(
					0.25,
					(rect.top + rect.height / 3 - event.clientY) / innerHeight,
				),
			);
			renderer.focus(x, y);
		},
		{ signal: listeners.signal, passive: true },
	);
	document.documentElement.addEventListener(
		"pointerleave",
		() => renderer?.focus(0, 0),
		{ signal: listeners.signal },
	);
	for (const event of [
		"visibilitychange",
		"swup:content:replace",
		"swup:page:view",
	])
		document.addEventListener(event, queueReconcile, {
			signal: listeners.signal,
		});
	document.addEventListener("toggle", queueReconcile, {
		capture: true,
		signal: listeners.signal,
	});
	document.addEventListener(
		"transitionend",
		(event) => {
			if (event.target === currentMusic) queueReconcile();
		},
		{ signal: listeners.signal },
	);
	window.addEventListener("resize", queueReconcile, {
		signal: listeners.signal,
		passive: true,
	});
	window.addEventListener(
		"pagehide",
		() => {
			resetInteraction();
			renderer?.setPaused(true);
		},
		{ signal: listeners.signal },
	);
	window.addEventListener("pageshow", queueReconcile, {
		signal: listeners.signal,
	});
	media.addEventListener("change", queueReconcile, {
		signal: listeners.signal,
	});
	motionMedia.addEventListener("change", queueReconcile, {
		signal: listeners.signal,
	});
	const rootObserver = new MutationObserver(queueReconcile);
	rootObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-music-form"],
	});
	const shellObserver = new MutationObserver(queueReconcile);
	shellObserver.observe(document.body, {
		childList: true,
		attributes: true,
		attributeFilter: ["class"],
	});
	reconcile();
	return () => {
		disconnected = true;
		stop();
		listeners.abort();
		cancelAnimationFrame(reconcileFrame);
		rootObserver.disconnect();
		shellObserver.disconnect();
		searchObserver?.disconnect();
		musicObserver?.disconnect();
	};
}

if (!customElements.get("shirone-mascot")) {
	customElements.define(
		"shirone-mascot",
		class extends HTMLElement {
			private cleanup?: () => void;
			connectedCallback(): void {
				this.cleanup ??= mount(this);
			}
			disconnectedCallback(): void {
				this.cleanup?.();
				this.cleanup = undefined;
			}
		},
	);
}
