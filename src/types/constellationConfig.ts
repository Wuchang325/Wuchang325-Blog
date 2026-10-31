/**
 * 连线粒子背景（constellation）配置契约。
 *
 * 自研轻量引擎，不依赖任何第三方粒子库：
 * 粒子自由漂浮，两两距离小于阈值时按距离衰减绘制连线，鼠标靠近时产生排斥。
 * 与鼠标拖尾共用同一套生命周期约定（DPR 钳制、reduced-motion 静止、
 * 触屏禁用、后台暂停、开关即停），但使用独立 canvas 与独立 rAF。
 */
export interface ConstellationConfig {
	/** 是否启用（默认 true；false 时零 canvas、零 rAF、零监听） */
	enable?: boolean;
	/** 粒子数量 (12 ~ 160，默认 64) */
	count?: number;
	/** 连线距离阈值，像素 (60 ~ 260，默认 150) */
	maxDistance?: number;
	/** 漂浮速度倍率 (0 ~ 2，默认 0.4) */
	speed?: number;
	/** 整体不透明度 (0.05 ~ 1，默认 0.55) */
	opacity?: number;
	/**
	 * 主色。`"theme"` 跟随 `--primary` 动态取色（默认），
	 * 也可传 `"45,175,255"` 形式的 RGB 三元组。
	 */
	color?: string;
	/** 鼠标排斥半径，像素 (0 ~ 400，默认 140；0 表示不排斥) */
	repelRadius?: number;
	/** 排斥强度 (0 ~ 2，默认 0.6) */
	repelForce?: number;
	/** 连线宽度 (0.4 ~ 3，默认 1) */
	lineWidth?: number;
}

/** 规范化解析后的连线粒子配置 */
export interface ResolvedConstellationOptions {
	enable: boolean;
	count: number;
	maxDistance: number;
	speed: number;
	opacity: number;
	color: string;
	repelRadius: number;
	repelForce: number;
	lineWidth: number;
}
