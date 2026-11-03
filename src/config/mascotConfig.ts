import type { MascotConfig, ResolvedMascotOptions } from "@/types/mascotConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 本站按所有者要求显式开启伊蕾娜。通用/未配置的解析默认仍为关闭；
 * 其他站点应设置 enable: false，准备自有模型与同源 Core 后再开启。
 * 关闭时零组件 DOM、零特性样式和客户端资源引用。
 */
export const mascotConfig: MascotConfig = withUserConfig("mascot", {
	enable: true,
	coreUrl: "/live2d/vendor/cubism-core-5.1.0.min.js",
	minWidth: 1280,
	size: 280,
	followPointer: true,
});

function isAssetUrl(value: string): boolean {
	return /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value);
}

export function resolveMascotOptions(
	config?: MascotConfig,
): ResolvedMascotOptions | null {
	if (config?.enable !== true) return null;
	const coreUrl = config.coreUrl?.trim();
	if (!coreUrl || !isAssetUrl(coreUrl)) return null;
	const minWidth = Number.isFinite(config.minWidth)
		? Math.max(1024, Math.min(2560, Math.round(config.minWidth as number)))
		: 1280;
	return {
		coreUrl,
		minWidth,
		size: config.size === 240 || config.size === 320 ? config.size : 280,
		followPointer: config.followPointer !== false,
	};
}
