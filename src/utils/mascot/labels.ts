import type { MascotReaction } from "@/types/mascotConfig";

export const mascotDialogue: Readonly<Record<MascotReaction, string>> = {
	tap: "你好呀，旅人！",
	wink: "欸？又见面了。",
	shy: "这样一直看着我，会害羞的……",
	flustered: "不、不要一直点啦！",
	like: "哼哼，眼光不错！",
};

/** 本站明确只提供中文，看板娘文案集中维护，不扩展其他 locale。 */
export function mascotLabels(name: string): {
	landmark: string;
	setting: string;
	interact: string;
	controls: string;
	smaller: string;
	larger: string;
	hide: string;
	restore: string;
	loading: string;
	failed: string;
	retry: string;
} {
	return {
		landmark: `${name}看板娘`,
		setting: "显示看板娘",
		interact: `和${name}互动`,
		controls: "看板娘控制",
		smaller: "缩小看板娘",
		larger: "放大看板娘",
		hide: "收起看板娘",
		restore: `显示${name}`,
		loading: `${name}正在准备中…`,
		failed: "看板娘暂时未能加载",
		retry: "重试",
	};
}
