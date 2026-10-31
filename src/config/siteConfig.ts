import type { SiteConfig } from "@/types/config";
import type {
	ConstellationConfig,
	ResolvedConstellationOptions,
} from "@/types/constellationConfig";
import type { CursorConfig, ResolvedCursorOptions } from "@/types/cursorConfig";
import type {
	MouseEffectConfig,
	ResolvedMouseEffectOptions,
} from "@/types/mouseEffectConfig";
import type {
	ResolvedTextureOptions,
	TextureConfig,
} from "@/types/textureConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 站点核心配置：标题 / 语言 / 主题色（HCT 动态配色）/ 横幅 / 目录 / 进度条 / favicon。
 * 类型见 src/types/config.ts。
 */
export const siteConfig: SiteConfig = withUserConfig("site", {
	site: "https://blog.zient.top/",
	base: "/",
	title: "无常の小窝",
	subtitle: "无常的个人博客，记录生活点滴与技术笔记",
	// 电脑端顶栏标题与导航内容区域："left" 左对齐，"center" 居中。
	topAppBar: {
		contentAlign: "center",
	},
	// 显示设置面板控制：配置各项前端切换项的可见性（默认全部开启）。
	// 关闭某项后，面板中不再渲染该项，同时该维度会忽略访客浏览器中已有的历史偏好，
	// 强制回落到下方的站点配置值（不是单纯隐藏 UI）。
	displaySettings: {
		hue: false, // 是否展示主题色相（0-360）滑块
		colorStyle: false, // 是否展示配色风格 9 宫格
		colorSpec: false, // 是否展示 Color Spec 调色规范切换
		wallpaperMode: false, // 是否展示页面背景（纯色/横幅）切换
		layoutMode: true, // 是否展示文章列表布局（列表/网格）切换
		reduceMotion: true, // 是否展示减少动效切换
		texture: true, // 是否展示背景纹理选择
	},
	// 右上角语言提示：站点只提供简体中文，访客浏览器首选语言非中文时弹一次提示。
	// 关闭后不渲染组件、不产生任何客户端脚本。
	languageNotice: {
		enable: true,
	},
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	// IANA time zone for precise post and moment timestamps. It is independent of lang.
	timeZone: "Asia/Shanghai",
	themeColor: {
		hue: 300, // Default hue 0-360. 站点设计默认粉紫（偏二次元）；262 紫 / 345 粉 也可选
		fixed: false, // 隐藏整个「显示设置」入口按钮（会连带隐藏布局/纹理/动效设置）；只想锁色相请用 displaySettings.hue
		// Dynamic Material 3 palette style (TonalSpot/Vibrant/Content/Expressive/Rainbow/FruitSalad/Monochrome/Neutral/Fidelity)
		style: "tonalSpot",
		// Design spec version: "2021" (MD3) or "2025" (M3 Expressive)。角色集一致，
		// 差异仅在调色板派生（库的 colorSpec 静态为 2025 委托）
		spec: "2025",
	},
	// 默认页面背景模式："banner" 使用壁纸横幅，"none" 使用主题纯色。
	// displaySettings.wallpaperMode 为 true 时，访客选择会保存在浏览器中并覆盖此默认值；
	// 为 false 时锁定为此值，访客无法更改。
	wallpaperMode: {
		defaultMode: "banner",
	},
	// 页面背景纹理系统配置（5 大精美预设 + 零开销 HCT 动态取色）
	texture: {
		enable: true, // 是否启用背景纹理系统
		defaultPreset: "starlight", // 默认纹理预设："none" | "starlight" | "cyber-dots" | "topography" | "geometric" | "sakura"
		defaultOpacity: 0.12, // 默认纹理浓度 (0.05 ~ 0.25)
		allowMotion: true, // 是否允许背景微动效（开启 reduced-motion 时自动静止）
	},
	// 自定义鼠标指针皮肤（内置 32×32 八帧序列，来自 Windows .ani 光标包逐帧导出）
	cursor: {
		enable: true, // 是否启用自定义指针（关闭后完全回退系统光标）
		skin: "sakura", // 皮肤名；"none" 等价于关闭
		animate: true, // 是否播放八帧动画（关闭时只显示首帧，零定时器）
		speed: 1, // 动画速度倍率 (0.25 ~ 4)
		hotspot: [1, 1], // 热点坐标 [x, y]，箭头尖端
	},
	// 鼠标拖尾粒子效果（canvas 流星拖尾 + 点击冲击波）
	mouseEffect: {
		enable: true, // 是否启用（关闭时零 canvas、零 rAF、零监听）
		color: "theme", // "theme" 跟随 --primary；也可写 "45,175,255" 形式的 RGB 三元组
		scale: 1.5, // 整体缩放 (0.5 ~ 3)
		opacity: 1, // 不透明度 (0.1 ~ 1)
		speed: 1, // 播放速度 (0.2 ~ 3)
		maxTrail: 16, // 拖尾保留的历史点数 (4 ~ 32)
		alwaysTrail: true, // 不按下鼠标也持续拖尾
		clickBurst: true, // 点击时产生冲击波与爆散粒子
		glow: 3, // 拖尾描边发光半径 (0 ~ 8)
	},
	// 连线粒子背景（自研轻量引擎，粒子漂浮 + 距离连线 + 鼠标排斥）
	constellation: {
		enable: true, // 是否启用（关闭时零 canvas、零 rAF、零监听）
		count: 64, // 粒子数量 (12 ~ 160)
		maxDistance: 150, // 连线距离阈值，像素 (60 ~ 260)
		speed: 0.4, // 漂浮速度倍率 (0 ~ 2)
		opacity: 0.55, // 整体不透明度 (0.05 ~ 1)
		color: "theme", // "theme" 跟随 --primary；也可写 "45,175,255"
		repelRadius: 140, // 鼠标排斥半径，像素 (0 ~ 400；0 表示不排斥)
		repelForce: 0.6, // 排斥强度 (0 ~ 2)
		lineWidth: 1, // 连线宽度 (0.4 ~ 3)
	},
	banner: {
		// 推荐将图片放入 src/assets，并填写相对 src 的路径，以启用构建期 AVIF/WebP 响应式优化。
		// 以 "/" 开头的 public 路径与远程 URL 仍可用，但会保留原图、不生成候选。
		// desktop 用于 >= 1024px；mobile 仅用于 < 1024px 的首页，手机非首页不显示壁纸。
		// 数组顺序就是轮播顺序；只需要静态 Banner 时，每组保留一张图片即可。
		src: {
			desktop: [
				"https://api.imlazy.ink/img",
				//"assets/images/banner/desktop/1.webp",
				//"assets/images/banner/desktop/2.webp",
				//"assets/images/banner/desktop/3.webp",
				//"assets/images/banner/desktop/4.webp",
			],
			mobile: [
				"https://api.imlazy.ink/img-phone",
				//"assets/images/banner/mobile/1.webp"
			],
		},
		// 图片裁切焦点："top"、"center" 或 "bottom"。
		position: "center",
		dim: {
			// 在图片上覆盖黑色遮罩以提高标题和顶部栏的对比度；opacity 范围为 0-1。
			enable: true,
			opacity: 0.24,
		},
		homeText: {
			// 仅在首页 Banner 中显示，标题与副标题会上下居中排列。
			enable: true,
			title: "无常の小窝",
			subtitle: [
				"没有特别的事，但有你在就足够了",
				"至今你依然是我的光",
				"你啊，不知不觉间已经成了我的日常",
				"和你聊天，总觉得每天都会变得稍微开心一点",
				"今天是个平凡的日子。不过，是稍微有点好的日子",
				"不需要什么主角光环，有你在的日常就是最好的故事",
				"你不是路人角色，你故事里的主角就是你",
				"今天什么都没发生。但和你说上了话，所以是稍微不错的一天",
				"慢一点也没关系，勇者也是从新手村一步步走出来的",
				"你的光只是你自己看不见，其实早就照到大家了",
				"跌倒了也没关系，下一话再站起来就好",
				"平凡的一天，只要好好撑过来了，就已经很了不起了",
			],
			typewriter: {
				// 副标题逐字显示；关闭后直接显示完整副标题。
				enable: true,
				// 打字速度（每个字符间隔，毫秒）。
				speed: 100,
				// 回退反向删除速度（每个字符间隔，毫秒）。
				deleteSpeed: 50,
				// 打字完成后停顿时间，单位为毫秒。
				pauseTime: 2000,
				// 完成后是否循环播放；关闭表示只播放一次。
				loop: true,
			},
		},
		carousel: {
			// 是否开启多张图片自动轮播；多张图片时生效，单张图片时自动降级为静态展示。
			enable: true,
			// 轮播切换间隔时间（毫秒），运行时最小值限制为 3000ms。
			interval: 6000,
			// 交叉淡入淡出（Crossfade）过渡时长（毫秒，默认 1200ms）。
			fadeDuration: 1200,
			// 运镜呼吸动画模式："ken-burns"（默认，循环运镜）| "zoom-in"（推进）| "zoom-out"（拉远）| "pan-left"（左移）| "pan-right"（右移）| "none"（无运镜）。
			animation: "ken-burns",
		},
		waves: {
			// 在 Banner 底部渲染页面背景色水波纹；关闭后不输出波浪 DOM。
			enable: true,
		},
	},
	// Markdown 正文图片处理；仅匹配远程图片，不会产生额外网络请求或客户端代码。
	imageOptimization: {
		// 为需要防盗链兼容的图片 CDN 添加 referrerpolicy="no-referrer"，支持通配符。
		noReferrerDomains: [],
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 3, // Maximum heading depth to show in the table, from 1 to 3
	},
	progressIndicator: {
		// 进度条预设样式：dual 双向扫描（官方默认双线）/ single 单向扫描（单线）
		style: "dual",
	},
	favicon: [
		// 浏览器标签页图标，路径相对于 public 目录。
		{ src: "/logo/icon.webp" },
	],
});

/**
 * 解析并返回背景纹理配置选项（包含关闭短路与 0 开销优化判定）
 */
export function resolveTextureOptions(
	config: boolean | TextureConfig | undefined = siteConfig.texture,
	displaySettingsTexture: boolean = siteConfig.displaySettings?.texture ?? true,
): ResolvedTextureOptions {
	if (config === false || config === undefined) {
		return {
			enable: false,
			defaultPreset: "none",
			defaultOpacity: 0.12,
			allowMotion: false,
		};
	}

	if (config === true) {
		return {
			enable: true,
			defaultPreset: "starlight",
			defaultOpacity: 0.12,
			allowMotion: true,
		};
	}

	const enable = config.enable ?? true;
	const defaultPreset = config.defaultPreset ?? "starlight";
	const defaultOpacity = config.defaultOpacity ?? 0.12;
	const allowMotion = config.allowMotion ?? true;

	// 性能短路优化：
	// 如果配置 enable: false，或者 defaultPreset: "none" 且显示设置面板未允许切换（访客也无法开启），
	// 则自动视为完全关闭以达成零 DOM、零 CSS、零运行时代价。
	const effectiveEnable =
		enable && (defaultPreset !== "none" || displaySettingsTexture);

	return {
		enable: effectiveEnable,
		defaultPreset,
		defaultOpacity,
		allowMotion,
	};
}

/** 数值钳制：非有限值一律回退到默认值 */
function clampNumber(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(Math.max(n, min), max);
}

/**
 * 解析并返回自定义鼠标指针配置。
 *
 * 关闭短路：`enable: false` 或 `skin: "none"` 时返回 `enable: false`，
 * 调用方据此不注入任何 cursor 规则、不启动帧定时器。
 */
export function resolveCursorOptions(
	config: boolean | CursorConfig | undefined = siteConfig.cursor,
	displaySettingsCursor: boolean = siteConfig.displaySettings?.cursor ?? true,
): ResolvedCursorOptions {
	const defaults: ResolvedCursorOptions = {
		enable: false,
		skin: "none",
		animate: false,
		speed: 1,
		hotspot: [1, 1],
	};

	if (config === false || config === undefined) return defaults;
	if (config === true) {
		return {
			enable: displaySettingsCursor,
			skin: "sakura",
			animate: true,
			speed: 1,
			hotspot: [1, 1],
		};
	}

	const skin = config.skin ?? "sakura";
	const hotspot = config.hotspot;
	const validHotspot =
		Array.isArray(hotspot) &&
		hotspot.length === 2 &&
		Number.isFinite(hotspot[0]) &&
		Number.isFinite(hotspot[1]);

	return {
		enable: (config.enable ?? true) && skin !== "none",
		skin,
		animate: config.animate ?? true,
		speed: clampNumber(config.speed, 0.25, 4, 1),
		hotspot: validHotspot
			? ([Math.max(0, hotspot[0]), Math.max(0, hotspot[1])] as const)
			: ([1, 1] as const),
	};
}

/**
 * 解析并返回鼠标拖尾粒子效果配置。
 *
 * 关闭短路：`enable: false` 时返回 `enable: false`，调用方不渲染 canvas，
 * 效果组件因此完全不进入客户端包。
 */
export function resolveMouseEffectOptions(
	config: boolean | MouseEffectConfig | undefined = siteConfig.mouseEffect,
	displaySettingsMouseEffect: boolean = siteConfig.displaySettings
		?.mouseEffect ?? true,
): ResolvedMouseEffectOptions {
	const defaults: ResolvedMouseEffectOptions = {
		enable: false,
		color: "theme",
		scale: 1.5,
		opacity: 1,
		speed: 1,
		maxTrail: 16,
		alwaysTrail: true,
		clickBurst: true,
		glow: 3,
	};

	if (config === false || config === undefined) return defaults;
	if (config === true) {
		return { ...defaults, enable: displaySettingsMouseEffect };
	}

	const color =
		typeof config.color === "string" && config.color.trim()
			? config.color.trim()
			: "theme";

	return {
		enable: config.enable ?? true,
		color,
		scale: clampNumber(config.scale, 0.5, 3, 1.5),
		opacity: clampNumber(config.opacity, 0.1, 1, 1),
		speed: clampNumber(config.speed, 0.2, 3, 1),
		maxTrail: Math.round(clampNumber(config.maxTrail, 4, 32, 16)),
		alwaysTrail: config.alwaysTrail ?? true,
		clickBurst: config.clickBurst ?? true,
		glow: clampNumber(config.glow, 0, 8, 3),
	};
}

/**
 * 解析并返回连线粒子背景配置。
 *
 * 关闭短路：`enable: false` 时返回 `enable: false`，调用方不渲染 canvas，
 * 组件因此完全不进入客户端包。
 */
export function resolveConstellationOptions(
	config: boolean | ConstellationConfig | undefined = siteConfig.constellation,
	displaySettingsConstellation: boolean = siteConfig.displaySettings
		?.constellation ?? true,
): ResolvedConstellationOptions {
	const defaults: ResolvedConstellationOptions = {
		enable: false,
		count: 64,
		maxDistance: 150,
		speed: 0.4,
		opacity: 0.55,
		color: "theme",
		repelRadius: 140,
		repelForce: 0.6,
		lineWidth: 1,
	};

	if (config === false || config === undefined) return defaults;
	if (config === true) {
		return { ...defaults, enable: displaySettingsConstellation };
	}

	const color =
		typeof config.color === "string" && config.color.trim()
			? config.color.trim()
			: "theme";

	return {
		enable: config.enable ?? true,
		count: Math.round(clampNumber(config.count, 12, 160, 64)),
		maxDistance: clampNumber(config.maxDistance, 60, 260, 150),
		speed: clampNumber(config.speed, 0, 2, 0.4),
		opacity: clampNumber(config.opacity, 0.05, 1, 0.55),
		color,
		repelRadius: clampNumber(config.repelRadius, 0, 400, 140),
		repelForce: clampNumber(config.repelForce, 0, 2, 0.6),
		lineWidth: clampNumber(config.lineWidth, 0.4, 3, 1),
	};
}

/** 站点默认配色风格（访客未做选择时的回退值） */
export function getDefaultStyle(): string {
	return siteConfig.themeColor.style;
}

/** 站点默认 Color Spec（2021 / 2025） */
export function getDefaultSpec(): string {
	return siteConfig.themeColor.spec;
}

/** 解析并返回显示设置面板各项开关（未配置时默认 true） */
export function resolveDisplaySettings(): {
	hue: boolean;
	colorStyle: boolean;
	colorSpec: boolean;
	wallpaperMode: boolean;
	layoutMode: boolean;
	reduceMotion: boolean;
	texture: boolean;
	cursor: boolean;
	mouseEffect: boolean;
	constellation: boolean;
} {
	const cfg = siteConfig.displaySettings;
	const textureOpts = resolveTextureOptions(
		siteConfig.texture,
		cfg?.texture ?? true,
	);
	const cursorOpts = resolveCursorOptions(
		siteConfig.cursor,
		cfg?.cursor ?? true,
	);
	const mouseEffectOpts = resolveMouseEffectOptions(
		siteConfig.mouseEffect,
		cfg?.mouseEffect ?? true,
	);
	const constellationOpts = resolveConstellationOptions(
		siteConfig.constellation,
		cfg?.constellation ?? true,
	);
	return {
		hue: cfg?.hue ?? true,
		colorStyle: cfg?.colorStyle ?? true,
		colorSpec: cfg?.colorSpec ?? true,
		wallpaperMode: cfg?.wallpaperMode ?? true,
		layoutMode: cfg?.layoutMode ?? true,
		reduceMotion: cfg?.reduceMotion ?? true,
		texture: textureOpts.enable && (cfg?.texture ?? true),
		cursor: cursorOpts.enable && (cfg?.cursor ?? true),
		mouseEffect: mouseEffectOpts.enable && (cfg?.mouseEffect ?? true),
		constellation: constellationOpts.enable && (cfg?.constellation ?? true),
	};
}
