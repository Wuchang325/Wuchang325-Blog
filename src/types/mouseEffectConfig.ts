/**
 * 鼠标拖尾粒子效果配置契约。
 *
 * 效果本体是 canvas 绘制的「流星拖尾 + 点击冲击波 + 爆散三角粒子」，
 * 思路来自 DoomVoss/BASpark，按本项目的生命周期与零开销约定重写：
 * 关闭时（`enable: false`）不渲染 canvas、不启动 rAF、不绑定任何事件监听。
 */
export interface MouseEffectConfig {
	/** 是否启用（默认 true；设为 false 时零 DOM、零 canvas、零 rAF、零监听） */
	enable?: boolean;
	/**
	 * 主色。`"theme"` 跟随 `--primary` 动态取色（默认），
	 * 也可传 `"45,175,255"` 形式的 RGB 三元组。
	 */
	color?: string;
	/** 整体缩放 (0.5 ~ 3，默认 1.5) */
	scale?: number;
	/** 不透明度 (0.1 ~ 1，默认 1) */
	opacity?: number;
	/** 播放速度 (0.2 ~ 3，默认 1) */
	speed?: number;
	/** 拖尾保留的历史点数 (4 ~ 32，默认 16) */
	maxTrail?: number;
	/** 不按下鼠标也持续拖尾（默认 true） */
	alwaysTrail?: boolean;
	/** 点击时产生冲击波与爆散粒子（默认 true） */
	clickBurst?: boolean;
	/** 拖尾描边的发光模糊半径 (0 ~ 8，默认 3) */
	glow?: number;
}

/** 规范化解析后的鼠标效果配置选项 */
export interface ResolvedMouseEffectOptions {
	enable: boolean;
	color: string;
	scale: number;
	opacity: number;
	speed: number;
	maxTrail: number;
	alwaysTrail: boolean;
	clickBurst: boolean;
	glow: number;
}
