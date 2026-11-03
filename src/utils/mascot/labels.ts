/** 本站明确只提供中文，看板娘文案集中维护，不扩展其他 locale。 */
export function mascotLabels(name: string): {
	landmark: string;
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
