<script lang="ts">
/**
 * 自定义鼠标指针皮肤。
 *
 * 资源是 32×32 的八帧序列（`src/assets/cursor/*.png`），由 Windows `.ani`
 * 光标包逐帧导出。浏览器不支持 `.ani`，也无法对 `cursor` 做 CSS 动画，
 * 所以帧切换只能靠定时改写 CSS 变量实现。
 *
 * 开关状态挂在 `html[data-cursor-skin]` 上，与显示设置面板共用。
 * 关闭时只停止定时器，不保留任何 cursor 规则的效果。
 */

import { getStoredCursorEnabled } from "@utils/setting-utils";
import { onMount } from "svelte";
import type { ResolvedCursorOptions } from "@/types/cursorConfig";

let { options }: { options: ResolvedCursorOptions } = $props();

const FRAME_MS = 100;
const FRAME_COUNT = 8;
const STATES = ["normal", "link", "text", "unavailable", "busy"] as const;

const modules = import.meta.glob("../../assets/cursor/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

/** `normal-3.png` → frames.normal[3] */
const frames: Record<string, string[]> = {};
for (const [path, url] of Object.entries(modules)) {
	const match = path.match(/([a-z]+)-(\d+)\.png$/);
	if (!match) continue;
	const state = match[1];
	const list = frames[state] ?? [];
	frames[state] = list;
	list[Number(match[2])] = url;
}

onMount(() => {
	// 触屏设备没有悬停指针，光标皮肤没有意义：不设 dataset、不启定时器
	if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
		return;
	}
	const root = document.documentElement;
	const hotspot = `${options.hotspot[0]} ${options.hotspot[1]}`;
	let timer = 0;
	let frame = 0;

	const apply = () => {
		for (const state of STATES) {
			const list = frames[state];
			if (!list?.length) continue;
			const url = list[options.animate ? frame % list.length : 0];
			root.style.setProperty(
				`--m3e-cursor-${state}`,
				`url("${url}") ${hotspot}, auto`,
			);
		}
	};

	const motionReduced = () =>
		root.classList.contains("motion-reduced") ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const stop = () => {
		if (timer) {
			window.clearInterval(timer);
			timer = 0;
		}
	};

	const sync = () => {
		stop();
		if (root.dataset.cursorSkin !== "on") return;
		apply();
		// 减少动效时只保留首帧：帧动画属于装饰性高频变化
		if (!options.animate || motionReduced()) return;
		timer = window.setInterval(() => {
			if (document.hidden) return;
			frame = (frame + 1) % FRAME_COUNT;
			apply();
		}, FRAME_MS / options.speed);
	};

	// 首屏内联脚本已写过就沿用，否则按访客偏好补一次
	if (!root.dataset.cursorSkin) {
		root.dataset.cursorSkin = getStoredCursorEnabled() ? "on" : "off";
	}
	sync();

	const observer = new MutationObserver(sync);
	observer.observe(root, {
		attributes: true,
		attributeFilter: ["data-cursor-skin", "class"],
	});

	return () => {
		observer.disconnect();
		stop();
	};
});
</script>

<div class="m3e-cursor-skin" hidden></div>

<style>
	/* 指针规则整体挂在 html 的开关属性上：关闭时全部失效，回退系统光标。
	   整组规则再包一层精确指针媒体查询，触屏设备即使 dataset 为 on 也不会命中。 */
	@media (hover: hover) and (pointer: fine) {
		:global(html[data-cursor-skin="on"]) {
			cursor: var(--m3e-cursor-normal, auto);
		}

		:global(html[data-cursor-skin="on"] a),
		:global(html[data-cursor-skin="on"] button),
		:global(html[data-cursor-skin="on"] [role="button"]),
		:global(html[data-cursor-skin="on"] summary),
		:global(html[data-cursor-skin="on"] label),
		:global(html[data-cursor-skin="on"] select),
		:global(html[data-cursor-skin="on"] .cursor-pointer) {
			cursor: var(--m3e-cursor-link, pointer);
		}

		:global(html[data-cursor-skin="on"] textarea),
		:global(html[data-cursor-skin="on"] [contenteditable="true"]),
		:global(html[data-cursor-skin="on"] input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"])) {
			cursor: var(--m3e-cursor-text, text);
		}

		:global(html[data-cursor-skin="on"] [disabled]),
		:global(html[data-cursor-skin="on"] [aria-disabled="true"]) {
			cursor: var(--m3e-cursor-unavailable, not-allowed);
		}
	}

	.m3e-cursor-skin {
		display: none;
	}
</style>
