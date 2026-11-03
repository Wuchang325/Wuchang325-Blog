import type { MascotClientOptions, MascotSize } from "@/types/mascotConfig";
import { prefersReducedMotion } from "../motion";
import { loadScriptOnce } from "../script-loader";
import { mascotLabels } from "./labels";
import type { MascotRenderer } from "./renderer";

const sizes: MascotSize[] = [240, 280, 320];

function required<T extends HTMLElement>(
	root: HTMLElement,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing mascot element: ${selector}`);
	return element;
}

function mount(root: HTMLElement): () => void {
	const options = JSON.parse(
		root.dataset.options ?? "null",
	) as MascotClientOptions;
	const labels = mascotLabels(options.model.name);
	const stage = required(root, "[data-mascot-stage]");
	const tools = required(root, "[data-mascot-tools]");
	const message = required(root, "[data-mascot-message]");
	const status = required(root, "[data-mascot-status]");
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
	try {
		const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
		if (saved?.collapsed === true) collapsed = true;
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
	let readingSidebar = false;
	let reconcileFrame = 0;
	let searchObserver: MutationObserver | undefined;
	let musicObserver: MutationObserver | undefined;
	let currentSearch: Element | null = null;
	let currentMusic: Element | null = null;

	const persist = () => {
		try {
			localStorage.setItem(storageKey, JSON.stringify({ collapsed, size }));
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
		root.dataset.state = collapsed
			? "collapsed"
			: failed
				? "error"
				: renderer
					? "ready"
					: "loading";
		root.hidden = !media.matches || blocked;
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
		const left =
			Number.parseFloat(getComputedStyle(root).insetInlineStart) || 0;
		const width =
			Math.ceil(
				(size * options.model.canvasWidth) / options.model.canvasHeight,
			) + 24;
		const top = innerHeight - size - 16;
		if (readingSidebar) {
			const sidebar = document
				.querySelector("#sidebar")
				?.getBoundingClientRect();
			if (
				sidebar &&
				sidebar.left < left + width &&
				sidebar.right > left &&
				sidebar.top < innerHeight &&
				sidebar.bottom > top
			)
				return true;
		}
		return [
			...document.querySelectorAll<HTMLElement>(
				".music-floating__handle, .music-floating--open .music-floating__panel, .m3-floating-controls-container--start",
			),
		].some((element) => {
			if (!element.checkVisibility()) return false;
			const rect = element.getBoundingClientRect();
			return (
				rect.width > 0 &&
				rect.height > 0 &&
				rect.left < left + width &&
				rect.right > left &&
				rect.top < innerHeight &&
				rect.bottom > top
			);
		});
	};

	async function load(): Promise<void> {
		cancelIdle = undefined;
		if (
			disconnected ||
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
		if ((!media.matches || collapsed) && (renderer || pending || cancelIdle))
			stop();
		if (!media.matches || collapsed || blocked || document.hidden) {
			cancelIdle?.();
			cancelIdle = undefined;
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
					renderer?.interact();
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
	document.addEventListener(
		"pointermove",
		(event) => {
			const previous = readingSidebar;
			if (event.target instanceof Element && event.target.closest("#sidebar"))
				readingSidebar = true;
			else if (readingSidebar) {
				const rect = document
					.querySelector("#sidebar")
					?.getBoundingClientRect();
				if (
					!rect ||
					event.clientX < rect.left ||
					event.clientX > rect.right ||
					event.clientY < rect.top ||
					event.clientY > rect.bottom
				)
					readingSidebar = false;
			}
			if (previous !== readingSidebar) queueReconcile();
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
	window.addEventListener("resize", queueReconcile, {
		signal: listeners.signal,
		passive: true,
	});
	window.addEventListener("pagehide", () => renderer?.setPaused(true), {
		signal: listeners.signal,
	});
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
		attributeFilter: ["class"],
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
