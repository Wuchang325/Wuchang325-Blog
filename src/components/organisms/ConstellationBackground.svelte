<script lang="ts">
/**
 * 连线粒子背景（constellation）。
 *
 * 自研轻量引擎，零第三方依赖：
 * - 粒子自由漂浮，两两距离小于阈值时按距离衰减绘制连线
 * - 鼠标靠近产生排斥，粒子被推开
 * - 连线按透明度分 8 档批量描边，把每帧的 stroke 调用压到常数级
 * - 与鼠标拖尾共用生命周期约定：DPR 钳制、触屏禁用、后台暂停、开关即停
 *
 * 减少动效时不跑 rAF，只渲染一帧静态星图。
 */

import { resolveCanvasColor } from "@utils/color-utils";
import { onMount } from "svelte";
import type { ResolvedConstellationOptions } from "@/types/constellationConfig";

let { options }: { options: ResolvedConstellationOptions } = $props();

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const MAX_DPR = 2;
const MAX_DELTA = 0.05;
/** 连线透明度分档数：每档一次 stroke，避免逐条切换画笔状态 */
const ALPHA_BUCKETS = 8;

type Particle = { x: number; y: number; vx: number; vy: number; r: number };
type Segment = [number, number, number, number];

class Constellation {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private opts: ResolvedConstellationOptions;
	private color: string;

	private width = 0;
	private height = 0;
	private particles: Particle[] = [];
	private mouse: { x: number; y: number } | null = null;

	private raf = 0;
	private running = false;
	private lastFrame = 0;
	private destroyed = false;
	private resizeTimer = 0;
	private enabled = true;
	private hoverMql: MediaQueryList;
	private reducedMql: MediaQueryList;

	private onPointerMove = (event: PointerEvent) => {
		if (!this.enabled) return;
		this.mouse = { x: event.clientX, y: event.clientY };
	};

	private onPointerLeave = () => {
		this.mouse = null;
	};

	private onResize = () => {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(() => {
			this.resize();
			if (!this.running) this.draw();
		}, 120);
	};

	private onVisibility = () => {
		if (document.hidden) this.stop();
		else this.start();
	};

	constructor(canvas: HTMLCanvasElement, opts: ResolvedConstellationOptions) {
		this.canvas = canvas;
		this.opts = opts;
		this.hoverMql = window.matchMedia(FINE_POINTER_QUERY);
		this.reducedMql = window.matchMedia("(prefers-reduced-motion: reduce)");

		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas 2d context unavailable");
		this.ctx = ctx;

		this.color = resolveCanvasColor(opts.color, "168,85,247");

		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.resize();
		this.seed();
		this.bind();
	}

	private bind() {
		window.addEventListener("pointermove", this.onPointerMove, {
			passive: true,
		});
		document.addEventListener("pointerleave", this.onPointerLeave);
		window.addEventListener("resize", this.onResize, { passive: true });
		document.addEventListener("visibilitychange", this.onVisibility);
	}

	private seed() {
		this.particles = Array.from({ length: this.opts.count }, () => ({
			x: Math.random() * this.width,
			y: Math.random() * this.height,
			vx: (Math.random() - 0.5) * 1.2,
			vy: (Math.random() - 0.5) * 1.2,
			r: 0.8 + Math.random() * 1.5,
		}));
	}

	private resize() {
		const prevWidth = this.width || 1;
		const prevHeight = this.height || 1;
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = Math.round(this.width * dpr);
		this.canvas.height = Math.round(this.height * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		if (this.particles.length) {
			const sx = this.width / prevWidth;
			const sy = this.height / prevHeight;
			for (const p of this.particles) {
				p.x *= sx;
				p.y *= sy;
			}
		}
	}

	/** 有鼠标、开关打开、页面可见 */
	shouldRun(): boolean {
		if (this.destroyed || document.hidden) return false;
		if (!this.hoverMql.matches) return false;
		return document.documentElement.dataset.constellation !== "off";
	}

	private isMotionReduced(): boolean {
		return (
			this.reducedMql.matches ||
			document.documentElement.classList.contains("motion-reduced")
		);
	}

	start() {
		if (!this.shouldRun()) {
			this.stop();
			return;
		}
		this.enabled = true;
		// 减少动效时保留一帧静态星图：仍有装饰性，但零动画开销
		if (this.isMotionReduced()) {
			this.stop();
			this.draw();
			return;
		}
		this.wake();
	}

	stop() {
		this.enabled = false;
		this.running = false;
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		this.ctx.clearRect(0, 0, this.width, this.height);
	}

	destroy() {
		this.destroyed = true;
		this.stop();
		window.clearTimeout(this.resizeTimer);
		window.removeEventListener("pointermove", this.onPointerMove);
		document.removeEventListener("pointerleave", this.onPointerLeave);
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener("visibilitychange", this.onVisibility);
		this.particles.length = 0;
	}

	private wake() {
		if (this.running || this.destroyed || !this.shouldRun()) return;
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		this.running = true;
		this.lastFrame = performance.now();
		this.raf = requestAnimationFrame(this.loop);
	}

	private loop = (now: number) => {
		if (this.destroyed) return;
		if (!this.shouldRun() || this.isMotionReduced()) {
			this.stop();
			if (this.shouldRun()) this.draw();
			return;
		}
		if (!this.running) {
			this.raf = 0;
			return;
		}

		const delta = Math.min((now - this.lastFrame) / 1000, MAX_DELTA);
		this.lastFrame = now;
		this.update(delta);
		this.draw();
		this.raf = requestAnimationFrame(this.loop);
	};

	private update(delta: number) {
		const step = delta * 60;
		const { speed, repelRadius, repelForce } = this.opts;
		const margin = 24;

		for (const p of this.particles) {
			p.x += p.vx * speed * step;
			p.y += p.vy * speed * step;

			if (this.mouse && repelRadius > 0) {
				const dx = p.x - this.mouse.x;
				const dy = p.y - this.mouse.y;
				const dist = Math.hypot(dx, dy);
				if (dist < repelRadius && dist > 0.001) {
					const push = (1 - dist / repelRadius) * repelForce;
					p.x += (dx / dist) * push * step * 2;
					p.y += (dy / dist) * push * step * 2;
				}
			}

			// 回绕到另一侧，避免粒子在边缘堆积
			if (p.x < -margin) p.x = this.width + margin;
			else if (p.x > this.width + margin) p.x = -margin;
			if (p.y < -margin) p.y = this.height + margin;
			else if (p.y > this.height + margin) p.y = -margin;
		}
	}

	private draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);

		const { maxDistance, opacity, lineWidth } = this.opts;
		const maxDistSq = maxDistance * maxDistance;

		// 按透明度分桶，每桶只切一次画笔状态
		const buckets: Segment[][] = Array.from(
			{ length: ALPHA_BUCKETS },
			() => [],
		);
		for (let i = 0; i < this.particles.length; i++) {
			const a = this.particles[i];
			for (let j = i + 1; j < this.particles.length; j++) {
				const b = this.particles[j];
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const distSq = dx * dx + dy * dy;
				if (distSq > maxDistSq) continue;
				const t = 1 - Math.sqrt(distSq) / maxDistance;
				const bucket = Math.min(
					ALPHA_BUCKETS - 1,
					Math.floor(t * ALPHA_BUCKETS),
				);
				buckets[bucket].push([a.x, a.y, b.x, b.y]);
			}
		}

		ctx.lineWidth = lineWidth;
		for (let i = 0; i < ALPHA_BUCKETS; i++) {
			const segments = buckets[i];
			if (!segments.length) continue;
			const alpha = ((i + 0.5) / ALPHA_BUCKETS) * opacity * 0.55;
			ctx.strokeStyle = `rgba(${this.color},${alpha.toFixed(3)})`;
			ctx.beginPath();
			for (const [x1, y1, x2, y2] of segments) {
				ctx.moveTo(x1, y1);
				ctx.lineTo(x2, y2);
			}
			ctx.stroke();
		}

		ctx.fillStyle = `rgba(${this.color},${opacity})`;
		for (const p of this.particles) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

onMount(() => {
	// 触屏设备没有悬停指针：不建引擎、不绑事件、不跑 rAF
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;

	const canvas = document.getElementById(
		"m3e-constellation",
	) as HTMLCanvasElement | null;
	if (!canvas) return;

	let engine: Constellation;
	try {
		engine = new Constellation(canvas, options);
	} catch {
		return;
	}
	engine.start();

	const observer = new MutationObserver(() => {
		if (engine.shouldRun()) engine.start();
		else engine.stop();
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-constellation"],
	});

	return () => {
		observer.disconnect();
		engine.destroy();
	};
});
</script>

<canvas id="m3e-constellation" aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		/*
		 * 落在内容层 #main-layout（z-30）之下、页面背景之上：
		 * 卡片自带不透明底色，粒子只在卡片缝隙与页面边缘透出来，
		 * 作为环境背景而不压正文。负值不行——会被 html 背景整个盖掉。
		 */
		z-index: 15;
	}

	@media (hover: none) {
		canvas {
			display: none;
		}
	}
</style>
