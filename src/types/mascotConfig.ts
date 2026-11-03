/** 可选 Live2D 看板娘的站点行为。缺省或 enable: false 时不输出组件。 */
export interface MascotConfig {
	enable?: boolean;
	/** 同源 Cubism Core 脚本地址；不会自动回退到外部 CDN。 */
	coreUrl?: string;
	/** 自动展示的最小视口宽度；还需要精细指针及 hover 支持。默认 1280。 */
	minWidth?: number;
	/** 人物高度，默认 280。 */
	size?: MascotSize;
	/** 是否轻微跟随鼠标，默认 true；减少动态效果时始终关闭。 */
	followPointer?: boolean;
}

export type MascotSize = 240 | 280 | 320;

export interface ResolvedMascotOptions {
	coreUrl: string;
	minWidth: number;
	size: MascotSize;
	followPointer: boolean;
}

/** 模型内容资料；不同模型的参数范围需要独立验证。 */
export interface MascotModel {
	id: string;
	name: string;
	modelUrl: string;
	canvasWidth: number;
	canvasHeight: number;
	expressions: { parameter: string; value: number }[];
}

export interface MascotClientOptions extends ResolvedMascotOptions {
	model: MascotModel;
}
