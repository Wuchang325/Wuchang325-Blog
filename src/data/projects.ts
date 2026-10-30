/**
 * 项目页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/projectsConfig.ts 控制。
 */
import type { ProjectItem } from "@/types/projectsConfig";

export const projectsData: ProjectItem[] = [
	{
		key: "euoracraft-launcher",
		title: "EuoraCraft-Launcher",
		summary:
			"一个现代化的 Minecraft 启动器，提供丰富的功能，并支持插件拓展功能",
		category: "theme",
		phase: "building",
		technologies: ["Python", "Vue.js", "Vite", "Typescript", "TailwindCSS"],
		icon: "material-symbols:deployed-code-outline-rounded",
		//cover: "/assets/projects/shirone.webp",
		coverAlt: "Shirone theme homepage preview",
		featured: true,
		repository: "https://github.com/ECLTeam/EuoraCraft-Launcher",
		year: "2026",
	},
];

/** 获取所有项目数据列表 */
export function getProjectsList(): ProjectItem[] {
	return projectsData;
}
