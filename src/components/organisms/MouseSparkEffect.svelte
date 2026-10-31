<script lang="ts">
/**
 * 鼠标拖尾粒子效果（canvas）。
 *
 * 效果思路来自 DoomVoss/BASpark（https://github.com/DoomVoss/BASpark），
 * 版权归原作者所有；此处按本项目的生命周期约定重写：
 * - rAF 按需唤醒：没有存活粒子时不再申请下一帧，静止时零开销
 * - 只响应鼠标（pointerType === "mouse"），触屏设备不参与
 * - 尊重 html.motion-reduced 与 prefers-reduced-motion，命中即停
 * - 后台标签页暂停，DPR 钳制到 2，避免超大画布
 */

import { resolveCanvasColor } from "@utils/color-utils";
import { onMount } from "svelte";
import type { ResolvedMouseEffectOptions } from "@/types/mouseEffectConfig";

let { options }: { options: ResolvedMouseEffectOptions } = $props();

const BASE_FRAME_MS = 1000 / 60;
const MAX_DELTA_MS = 100;
const MAX_DPR = 2;
const TRAIL_MIN_DISTANCE = 2;
/** 只有同时具备悬停能力与精确指针（鼠标/触控板）才启用 */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

type Vec = { x: number; y: number };
type TrailPoint = Vec & { life: number };
type Spark = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	rot: number;
	rs: number;
	s: number;
	a: number;
	f: number;
};
type RingSegment = { off: number; len: number };
type Wave = {
	x: number;
	y: number;
	life: number;
	max: number;
	r: number;
	ring: {
		ang: number;
		life: number;
		maxLife: number;
		rs: number;
		segs: RingSegment[];
	};
};

class MouseSpark {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private opts: ResolvedMouseEffectOptions;
	private color: string;

	private width = 0;
	private height = 0;

	private trail: TrailPoint[] = [];
	private sparks: Spark[] = [];
	private waves: Wave[] = [];
	private sparkPool: Spark[] = [];
	private wavePool: Wave[] = [];

	private isDown = false;
	private lastPos: Vec | null = null;

	private raf = 0;
	private running = false;
	private lastFrame = 0;
	private destroyed = false;
	private resizeTimer = 0;
	/** 触屏设备 / 无悬停能力时不启用，缓存 MQL 避免每帧重新匹配 */
	private hoverMql: MediaQueryList;
	private reducedMql: MediaQueryList;
	/**
	 * 当前是否允许收集轨迹。关闭开关时置 false：
	 * 否则 pointermove 仍会往 trail 里塞点，重新开启的瞬间会一次性
	 * 画出关闭期间累积的整条轨迹（表现为"卡住不动的长线"）。
	 */
	private enabled = true;

	private onPointerMove = (event: PointerEvent) => {
		if (!this.enabled) return;
		if (event.pointerType !== "mouse") return;
		if (!this.isDown && !this.opts.alwaysTrail) return;
		const point = { x: event.clientX, y: event.clientY };
		if (!this.lastPos) this.lastPos = point;
		const dx = point.x - this.lastPos.x;
		const dy = point.y - this.lastPos.y;
		if (Math.hypot(dx, dy) <= TRAIL_MIN_DISTANCE) return;

		this.lastPos = point;
		this.trail.push({ x: point.x, y: point.y, life: 1 });
		if (this.trail.length > this.opts.maxTrail) this.trail.shift();

		if (Math.random() < 0.3) {
			const angle = Math.random() * Math.PI * 2;
			const speedAdjust = this.opts.scale / 1.5;
			this.sparks.push({
				x: point.x + Math.cos(angle) * 10 * this.opts.scale,
				y: point.y + Math.sin(angle) * 10 * this.opts.scale,
				vx: Math.cos(angle) * 1.3 * speedAdjust,
				vy: Math.sin(angle) * 1.3 * speedAdjust,
				rot: Math.random() * Math.PI * 2,
				rs: 0.16,
				s: 9 * this.opts.scale,
				a: 0.7,
				f: 0.95,
			});
		}
		this.wake();
	};

	private onPointerDown = (event: PointerEvent) => {
		if (!this.enabled) return;
		if (event.pointerType !== "mouse") return;
		this.isDown = true;
		this.lastPos = { x: event.clientX, y: event.clientY };
		if (this.opts.clickBurst) this.boom(event.clientX, event.clientY);
		this.wake();
	};

	private onPointerUp = () => {
		this.isDown = false;
	};

	private onResize = () => {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(() => this.resize(), 120);
	};

	private onVisibility = () => {
		if (document.hidden) this.stop();
		// 回到前台用 start() 而不是 wake()：stop() 把 enabled 置 false 了，
		// 必须重新打开收集开关，否则恢复后拖尾不再累积
		else this.start();
	};

	constructor(canvas: HTMLCanvasElement, opts: ResolvedMouseEffectOptions) {
		this.canvas = canvas;
		this.opts = opts;
		this.hoverMql = window.matchMedia(FINE_POINTER_QUERY);
		this.reducedMql = window.matchMedia("(prefers-reduced-motion: reduce)");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas 2d context unavailable");
		this.ctx = ctx;
		this.color = resolveCanvasColor(opts.color, "168,85,247");
		this.resize();
		this.bind();
	}

	private bind() {
		window.addEventListener("pointermove", this.onPointerMove, {
			passive: true,
		});
		window.addEventListener("pointerdown", this.onPointerDown, {
			passive: true,
		});
		window.addEventListener("pointerup", this.onPointerUp, { passive: true });
		window.addEventListener("resize", this.onResize, { passive: true });
		document.addEventListener("visibilitychange", this.onVisibility);
	}

	/** 当前是否应该运行：有鼠标、开关打开、未开启减少动效、页面可见 */
	shouldRun(): boolean {
		if (this.destroyed || document.hidden) return false;
		if (!this.hoverMql.matches) return false;
		if (document.documentElement.dataset.mouseEffect === "off") return false;
		if (document.documentElement.classList.contains("motion-reduced")) {
			return false;
		}
		return !this.reducedMql.matches;
	}

	start() {
		if (this.shouldRun()) {
			this.enabled = true;
			this.wake();
		} else {
			this.stop();
		}
	}

	stop() {
		this.enabled = false;
		this.running = false;
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		// 关闭期间不再收集轨迹，但关闭前可能已经攒了半截拖尾与未衰减的粒子。
		// 一并清空，避免重新开启的第一帧把它们一次性画成一条静止的长线。
		this.trail.length = 0;
		this.sparks.length = 0;
		this.waves.length = 0;
		this.sparkPool.length = 0;
		this.wavePool.length = 0;
		this.isDown = false;
		this.lastPos = null;
		this.clear();
	}

	destroy() {
		this.destroyed = true;
		this.stop();
		window.clearTimeout(this.resizeTimer);
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("pointerdown", this.onPointerDown);
		window.removeEventListener("pointerup", this.onPointerUp);
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener("visibilitychange", this.onVisibility);
		this.trail.length = 0;
		this.sparks.length = 0;
		this.waves.length = 0;
	}

	private resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = Math.round(this.width * dpr);
		this.canvas.height = Math.round(this.height * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private clear() {
		this.ctx.clearRect(0, 0, this.width, this.height);
	}

	/** 有活粒子时才申请下一帧；空闲即停 */
	private wake() {
		if (this.running || this.destroyed || !this.shouldRun()) return;
		// 防御：running 为 false 却还挂着调度，说明上一次 stop 与 loop 尾部的
		// 调度撞过车。先取消再重新申请，保证任何时候只有一条 rAF 链。
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		this.running = true;
		this.lastFrame = performance.now();
		this.raf = requestAnimationFrame(this.loop);
	}

	private alpha(value: number): number {
		return Math.max(0, Math.min(1, value * this.opts.opacity));
	}

	private boom(x: number, y: number) {
		let wave: Wave;
		if (this.wavePool.length > 0) {
			wave = this.wavePool.pop() as Wave;
			wave.x = x;
			wave.y = y;
			wave.life = 0;
			wave.max = 18;
			wave.r = 0;
			wave.ring.ang = Math.random() * Math.PI * 2;
			wave.ring.life = 0;
		} else {
			wave = {
				x,
				y,
				life: 0,
				max: 18,
				r: 0,
				ring: {
					ang: Math.random() * Math.PI * 2,
					life: 0,
					maxLife: 30,
					rs: 0.08,
					segs: [
						{ off: -0.25 * Math.PI, len: 1.15 * Math.PI },
						{ off: 0, len: 1.15 * Math.PI },
						{ off: 0.25 * Math.PI, len: 1.15 * Math.PI },
					],
				},
			};
		}
		this.waves.push(wave);

		const speedAdjust = this.opts.scale / 1.5;
		for (let i = 0; i < 4; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = (4.8 + Math.random() * 2) * speedAdjust;
			let spark: Spark;
			if (this.sparkPool.length > 0) {
				spark = this.sparkPool.pop() as Spark;
				spark.x = x;
				spark.y = y;
				spark.vx = Math.cos(angle) * speed;
				spark.vy = Math.sin(angle) * speed;
				spark.rot = Math.random() * Math.PI * 2;
				spark.rs = (Math.random() - 0.5) * 0.28;
				spark.s = (4 + Math.random() * 3) * this.opts.scale;
				spark.a = 1;
				spark.f = 0.9;
			} else {
				spark = {
					x,
					y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					rot: Math.random() * Math.PI * 2,
					rs: (Math.random() - 0.5) * 0.28,
					s: (4 + Math.random() * 3) * this.opts.scale,
					a: 1,
					f: 0.9,
				};
			}
			this.sparks.push(spark);
		}
	}

	private loop = (now: number) => {
		if (this.destroyed) return;
		if (!this.shouldRun()) {
			this.stop();
			return;
		}
		// 已 stop（但本轮回调仍被排队执行）时不再绘制，避免关闭后又闪一帧
		if (!this.running) {
			this.raf = 0;
			return;
		}

		const deltaMs = Math.min(now - this.lastFrame, MAX_DELTA_MS);
		this.lastFrame = now;
		const frameScale = (deltaMs / BASE_FRAME_MS) * this.opts.speed;

		this.update(frameScale);
		this.draw();

		if (this.trail.length || this.sparks.length || this.waves.length) {
			this.raf = requestAnimationFrame(this.loop);
		} else {
			this.running = false;
			this.raf = 0;
			this.clear();
		}
	};

	private update(frameScale: number) {
		for (let i = this.trail.length - 1; i >= 0; i--) {
			const point = this.trail[i];
			point.life -= (this.isDown ? 0.085 : 0.18) * frameScale;
			if (point.life <= 0) this.trail.splice(i, 1);
		}

		for (let i = this.waves.length - 1; i >= 0; i--) {
			const wave = this.waves[i];
			wave.life += frameScale;
			const progress = wave.life / wave.max;
			const ease = 1 - (1 - Math.min(progress, 1)) ** 3;
			wave.r = 26 * this.opts.scale * ease;
			wave.ring.life += frameScale;
			wave.ring.ang -= wave.ring.rs * frameScale;
			const ringProgress = Math.min(wave.ring.life / wave.ring.maxLife, 1);
			if (progress >= 1 && ringProgress >= 1) {
				this.wavePool.push(wave);
				this.waves.splice(i, 1);
			}
		}

		for (let i = this.sparks.length - 1; i >= 0; i--) {
			const spark = this.sparks[i];
			spark.x += spark.vx * frameScale;
			spark.y += spark.vy * frameScale;
			spark.vx *= spark.f ** frameScale;
			spark.vy *= spark.f ** frameScale;
			spark.rot += spark.rs * frameScale;
			spark.a -= 0.032 * frameScale;
			if (spark.a <= 0) {
				this.sparkPool.push(spark);
				this.sparks.splice(i, 1);
			}
		}
	}

	private draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.globalCompositeOperation = "lighter";

		if (this.trail.length > 1) {
			ctx.beginPath();
			ctx.moveTo(this.trail[0].x, this.trail[0].y);
			for (let i = 1; i < this.trail.length; i++) {
				ctx.lineTo(this.trail[i].x, this.trail[i].y);
			}
			ctx.lineWidth = 5;
			const head = this.trail[this.trail.length - 1];
			const tail = this.trail[0];
			const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
			gradient.addColorStop(0, `rgba(${this.color}, 1)`);
			gradient.addColorStop(1, `rgba(${this.color}, 0)`);
			if (this.opts.glow > 0) {
				ctx.shadowColor = `rgba(${this.color}, 0.6)`;
				ctx.shadowBlur = this.opts.glow;
			}
			ctx.strokeStyle = gradient;
			ctx.stroke();
			ctx.shadowColor = "transparent";
			ctx.shadowBlur = 0;
		}

		for (const wave of this.waves) {
			const progress = wave.life / wave.max;
			const alpha = Math.max(0, 1 - progress);
			if (alpha > 0) {
				ctx.beginPath();
				ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(${this.color},${this.alpha(alpha)})`;
				ctx.fill();
			}

			const ringProgress = Math.min(wave.ring.life / wave.ring.maxLife, 1);
			const shrink = Math.max(0, 1 - ringProgress);
			for (const seg of wave.ring.segs) {
				const start = wave.ring.ang + seg.off;
				ctx.beginPath();
				ctx.arc(
					wave.x,
					wave.y,
					wave.r + 3 * this.opts.scale,
					start,
					start + seg.len * shrink,
				);
				ctx.lineWidth = 3.7;
				ctx.strokeStyle = `rgba(245,248,252,${this.alpha(1 - ringProgress)})`;
				ctx.stroke();
			}
		}

		for (const spark of this.sparks) {
			ctx.save();
			ctx.translate(spark.x, spark.y);
			ctx.rotate(spark.rot);
			ctx.beginPath();
			ctx.moveTo(0, -spark.s);
			ctx.lineTo(spark.s * 0.6, spark.s * 0.6);
			ctx.lineTo(-spark.s * 0.6, spark.s * 0.6);
			ctx.fillStyle = `rgba(255,255,255,${this.alpha(spark.a)})`;
			ctx.fill();
			ctx.restore();
		}

		ctx.globalCompositeOperation = "source-over";
	}
}

onMount(() => {
	// 触屏设备直接不初始化：不建引擎、不绑事件、不跑 rAF
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;

	const canvas = document.getElementById(
		"m3e-mouse-spark",
	) as HTMLCanvasElement | null;
	if (!canvas) return;

	let engine: MouseSpark;
	try {
		engine = new MouseSpark(canvas, options);
	} catch {
		return;
	}
	engine.start();

	// 开关 / 减少动效切换时同步启停（属性挂在 <html> 上）
	const observer = new MutationObserver(() => {
		if (engine.shouldRun()) engine.start();
		else engine.stop();
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-mouse-effect"],
	});

	return () => {
		observer.disconnect();
		engine.destroy();
	};
});
</script>

<canvas id="m3e-mouse-spark" aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		/* 高于顶栏（z-50）、低于抽屉（z-60）：粒子可见但不遮挡面板 */
		z-index: 55;
	}

	/* 触屏设备兜底：即使 JS 判断失效也不占位、不可见 */
	@media (hover: none) {
		canvas {
			display: none;
		}
	}
</style>
