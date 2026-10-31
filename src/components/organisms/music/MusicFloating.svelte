<script lang="ts">
/**
 * 音乐播放器悬浮形态。
 *
 * 收起时是贴边的小条（封面 + 播放状态），点击滑出完整播放器卡片。
 * 与侧栏形态共用同一个 music runtime（模块级单例），所以两边进度与状态始终一致；
 * 同一时刻只显示其中一个，由 `html[data-music-form]` 控制。
 *
 * 小条支持拖动：松手后吸附到最近的左边或右边，垂直位置按百分比记住。
 * 位置用 `transform` 定位而不是 left/right，避免展开时容器宽度变化把条挤走。
 */
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";
import type { ResolvedMusicOptions } from "@/config/musicConfig";
import type { MusicRuntime, MusicSnapshot } from "@/types/musicConfig";
import MusicSidebarClient from "./MusicSidebarClient.svelte";

interface Labels {
	previous: string;
	play: string;
	pause: string;
	next: string;
	mute: string;
	unmute: string;
	playbackMode: string;
	modeSequence: string;
	modeRepeatOne: string;
	modeShuffle: string;
	progress: string;
	volume: string;
	showPlaylist: string;
	hidePlaylist: string;
	empty: string;
	loading: string;
	notRequested: string;
	nowPlaying: string;
	errors: Record<string, string>;
}

let {
	options,
	labels,
	label,
}: {
	options: ResolvedMusicOptions;
	labels: Labels;
	/** 悬浮条的无障碍名称（音乐播放器） */
	label: string;
} = $props();

const EDGE_KEY = "music-floating-edge";
const POS_KEY = "music-floating-pos";
const HANDLE_W = 48;
const GAP = 8;
const DRAG_THRESHOLD = 5;
const MARGIN = 12;

type Edge = "left" | "right";

let open = $state(false);
let mounted = $state(false);
/** 客户端挂载完成前不算位置：SSR 阶段没有 window */
let ready = $state(false);
let runtime = $state<MusicRuntime | null>(null);
let snapshot = $state<MusicSnapshot | null>(null);

let edge = $state<Edge>("left");
/** 垂直位置，0–100 的百分比 */
let posY = $state(50);
/** 拖动中的实时像素坐标；null 表示未拖动 */
let dragPos = $state<{ x: number; y: number } | null>(null);
let handleEl: HTMLButtonElement | undefined = $state();
let panelEl: HTMLDivElement | undefined = $state();
/** 面板相对容器顶部的偏移：剩余空间不足时上移，保证整块留在视口内 */
let panelOffsetY = $state(0);
let dragging = false;
let startPoint = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };
let moved = false;

const handleHeight = 58;

/** 条左上角坐标：吸附到边 + 垂直百分比 */
function anchor(): { x: number; y: number } {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const x = edge === "left" ? 0 : vw - HANDLE_W;
	const centerY = (vh * posY) / 100;
	const y = Math.min(
		Math.max(centerY - handleHeight / 2, MARGIN),
		vh - handleHeight - MARGIN,
	);
	return { x, y };
}

const position = $derived(ready ? (dragPos ?? anchor()) : { x: 0, y: 0 });

function clamp(v: number, min: number, max: number) {
	return Math.min(Math.max(v, min), max);
}

function readStored() {
	try {
		const e = localStorage.getItem(EDGE_KEY);
		if (e === "left" || e === "right") edge = e;
		const p = Number(localStorage.getItem(POS_KEY));
		if (Number.isFinite(p) && p > 0 && p < 100) posY = p;
	} catch {
		// 隐私模式下读取失败用默认值
	}
}

function persist() {
	try {
		localStorage.setItem(EDGE_KEY, edge);
		localStorage.setItem(POS_KEY, String(Math.round(posY * 10) / 10));
	} catch {
		// 忽略
	}
}

function onPointerDown(event: PointerEvent) {
	if (event.button !== 0) return;
	// 阻止默认行为：否则拖过页面时会把沿途文字、图片一起框选
	event.preventDefault();
	dragging = true;
	moved = false;
	startPoint = { x: event.clientX, y: event.clientY };
	startPos = anchor();
	dragPos = { ...startPos };
	document.documentElement.classList.add("is-dragging-music");
	handleEl?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
	if (!dragging) return;
	const dx = event.clientX - startPoint.x;
	const dy = event.clientY - startPoint.y;
	if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
	if (!moved) return;

	const vw = window.innerWidth;
	const vh = window.innerHeight;
	dragPos = {
		x: clamp(startPos.x + dx, 0, vw - HANDLE_W),
		y: clamp(startPos.y + dy, MARGIN, vh - handleHeight - MARGIN),
	};
}

function onPointerUp(event: PointerEvent) {
	if (!dragging) return;
	dragging = false;
	document.documentElement.classList.remove("is-dragging-music");
	handleEl?.releasePointerCapture(event.pointerId);

	if (!moved) {
		// 没移动就是点击：展开 / 收起
		dragPos = null;
		open = !open;
		if (open) mounted = true;
		return;
	}

	// 兜底：万一默认行为已经产生了选区，拖动结束后清掉
	const selection = window.getSelection();
	if (selection && !selection.isCollapsed) selection.removeAllRanges();

	// 松手吸附到最近的边，并记住垂直位置
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const current = dragPos ?? anchor();
	const centerX = current.x + HANDLE_W / 2;
	edge = centerX < vw / 2 ? "left" : "right";
	posY = clamp(((current.y + handleHeight / 2) / vh) * 100, 5, 95);
	dragPos = null;
	persist();
}

function onResize() {
	// 吸附状态下位置是算出来的，resize 时清掉拖动残留即可
	if (!dragging) dragPos = null;
	void recalcPanel();
}

/**
 * 面板默认与条顶部对齐；下方空间不够时整体上移，
 * 优先保证面板完整落在视口内（即"朝空间足够的方向展开"）。
 */
async function recalcPanel() {
	await tick();
	const panel = panelEl;
	if (!panel) return;

	const height = panel.offsetHeight;
	if (!height) return;

	const vh = window.innerHeight;
	const containerTop = position.y;
	// 先尝试对齐顶部，再夹到视口内
	let offset = 0;
	if (containerTop + height > vh - MARGIN) {
		offset = vh - MARGIN - height - containerTop;
	}
	if (containerTop + offset < MARGIN) {
		offset = MARGIN - containerTop;
	}
	panelOffsetY = Math.round(offset);
}

function close() {
	open = false;
}

onMount(() => {
	readStored();
	ready = true;
	window.addEventListener("resize", onResize);

	let unsubscribe: (() => void) | undefined;
	let cancelled = false;
	void import("@utils/music").then(({ getMusicRuntime }) => {
		if (cancelled) return;
		runtime = getMusicRuntime(options);
		unsubscribe = runtime.subscribe((next) => {
			snapshot = next;
		});
	});

	return () => {
		cancelled = true;
		unsubscribe?.();
		window.removeEventListener("resize", onResize);
	};
});

const playing = $derived(snapshot?.status === "playing");
const cover = $derived(snapshot?.currentTrack?.cover ?? "");
const trackTitle = $derived(snapshot?.currentTrack?.title ?? "");

// 展开时按剩余空间决定面板上移多少
$effect(() => {
	if (!open) return;
	// 显式依赖条的位置：拖动或换边后要重新判断
	void position.y;
	void recalcPanel();
});

// 面板高度会随内容变化（封面加载、播放列表展开），跟随重算
$effect(() => {
	const panel = panelEl;
	if (!panel) return;
	const observer = new ResizeObserver(() => void recalcPanel());
	observer.observe(panel);
	return () => observer.disconnect();
});
</script>

<div
	class="music-floating"
	class:music-floating--open={open}
	class:music-floating--dragging={dragging}
	data-edge={edge}
	style="transform: translate3d({position.x}px, {position.y}px, 0); --panel-top: {panelOffsetY}px"
>
	<button
		bind:this={handleEl}
		type="button"
		class="music-floating__handle"
		aria-expanded={open}
		aria-label={label}
		title={trackTitle || label}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<span class="music-floating__cover">
			{#if cover}
				<img src={cover} alt="" width="40" height="40" loading="lazy" draggable="false" />
			{:else}
				<Icon icon="material-symbols:music-note" width="20" height="20" />
			{/if}
		</span>
		<span class="music-floating__state">
			<Icon
				icon={playing
					? "material-symbols:graphic-eq-rounded"
					: "material-symbols:play-arrow-rounded"}
				width="18"
				height="18"
			/>
		</span>
	</button>

	{#if mounted}
		<div
			bind:this={panelEl}
			class="music-floating__panel"
			class:music-floating__panel--open={open}
			aria-hidden={!open}
		>
			<div class="music-floating__panel-head">
				<span class="music-floating__panel-title">{label}</span>
				<button
					type="button"
					class="music-floating__close"
					aria-label={labels.hidePlaylist}
					onclick={close}
				>
					<Icon icon="material-symbols:close-rounded" width="18" height="18" />
				</button>
			</div>
			<div class="music-floating__body">
				<MusicSidebarClient {options} {labels} />
			</div>
		</div>
	{/if}
</div>

<style lang="stylus">
.music-floating
	position: fixed
	top: 0
	left: 0
	z-index: 45
	width: 3rem
	display: none
	pointer-events: none
	will-change: transform
	transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized)
	/* 收起时面板朝哪一侧让位：左贴边向左、右贴边向右 */
	--panel-dir: -1

	:global(html[data-music-form="floating"]) &
		display: block

	&[data-edge="right"]
		--panel-dir: 1

	/* 拖动时跟手，不要过渡 */
	&--dragging
		transition: none

	&__handle
		pointer-events: auto
		display: flex
		flex-direction: column
		align-items: center
		gap: 0.25rem
		width: 3rem
		padding: 0.5rem 0.25rem
		border: none
		background: var(--surface-container-high)
		box-shadow: var(--m3e-elevation-2, 0 2px 8px rgb(0 0 0 / 0.18))
		cursor: grab
		touch-action: none
		transition: background var(--m3e-duration-short) var(--m3e-easing-standard)

		&:hover
			background: var(--surface-container-highest)

	.music-floating--dragging &
		cursor: grabbing

	&__handle
		border-radius: 1rem

	&__cover
		display: flex
		align-items: center
		justify-content: center
		width: 2.5rem
		height: 2.5rem
		border-radius: 0.75rem
		overflow: hidden
		background: var(--surface-container)
		color: var(--on-surface-variant)

		img
			width: 100%
			height: 100%
			object-fit: cover

	&__state
		display: flex
		align-items: center
		justify-content: center
		color: var(--primary)

	/* 面板绝对定位，不参与布局：这样展开不会改变容器宽度、不会把条挤走 */
	&__panel
		pointer-events: auto
		position: absolute
		/* 默认对齐条顶部；剩余空间不足时由 JS 上移（--panel-top） */
		top: var(--panel-top, 0px)
		width: 20rem
		max-width: calc(100vw - 5rem)
		max-height: calc(100dvh - 4rem)
		overflow-y: auto
		overscroll-behavior: contain
		background: var(--surface-container-high)
		box-shadow: var(--m3e-elevation-3, 0 8px 24px rgb(0 0 0 / 0.22))
		opacity: 0
		visibility: hidden
		transform: translateX(calc(var(--panel-dir) * 1.5rem))
		transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized),
			opacity var(--m3e-duration-short) var(--m3e-easing-standard),
			visibility 0s linear var(--m3e-duration-medium)

	&[data-edge="left"] &__panel
		left: 3.5rem
		border-radius: 1.25rem

	&[data-edge="right"] &__panel
		right: 3.5rem
		border-radius: 1.25rem

	&__panel--open
		transform: translateX(0)
		opacity: 1
		visibility: visible
		transition-delay: 0s

	&__panel-head
		display: flex
		align-items: center
		justify-content: space-between
		gap: 0.5rem
		padding: 0.75rem 1rem 0.25rem

	&__panel-title
		font: var(--m3e-type-label-large)
		font-weight: 700
		color: var(--on-surface)

	&__close
		display: flex
		align-items: center
		justify-content: center
		width: 1.75rem
		height: 1.75rem
		border: none
		border-radius: 50%
		background: transparent
		color: var(--on-surface-variant)
		cursor: pointer

		&:hover
			background: var(--surface-container-highest)

	&__body
		padding: 0 1rem 1rem

@media (max-width: 640px)
	.music-floating__panel
		width: 17rem

/* 拖动期间全局禁选：否则指针划过页面会把沿途文字与图片一起框住 */
:global(html.is-dragging-music),
:global(html.is-dragging-music *)
	user-select: none
	-webkit-user-select: none
</style>
