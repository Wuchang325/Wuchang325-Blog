/**
 * 自定义鼠标指针皮肤配置契约。
 *
 * 皮肤资源是内置的 32×32 八帧序列（`src/assets/cursor/*.png`），
 * 由 Windows `.ani` 光标包逐帧导出。浏览器不支持 `.ani`，
 * 所以帧动画只能靠切换 CSS 变量实现。
 *
 * 关闭时（`enable: false`）不注入任何 cursor 规则、不启动定时器。
 */
export type CursorSkinName = "sakura" | "none";

export interface CursorConfig {
	/** 是否启用（默认 true） */
	enable?: boolean;
	/** 皮肤名；`"none"` 表示回退到系统光标（默认 `"sakura"`） */
	skin?: CursorSkinName;
	/** 是否播放八帧动画（默认 true；关闭时只显示首帧，零定时器） */
	animate?: boolean;
	/** 动画速度倍率 (0.25 ~ 4，默认 1；1 = 每帧 100ms) */
	speed?: number;
	/** 热点坐标 [x, y]，默认 [1, 1]（箭头尖端，取自光标包自带热点） */
	hotspot?: [number, number];
}

/** 规范化解析后的指针配置 */
export interface ResolvedCursorOptions {
	enable: boolean;
	skin: CursorSkinName;
	animate: boolean;
	speed: number;
	hotspot: readonly [number, number];
}
