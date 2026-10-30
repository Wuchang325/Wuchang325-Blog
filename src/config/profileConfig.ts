import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "assets/images/avatar.webp", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Wuchang325",
	bio: "一个热爱技术的高中生，喜欢折腾各种新鲜事物，热衷于分享自己的学习和生活经验。",
	links: [
		/*{
			name: "X",
			icon: "fa7-brands:x-twitter", // Visit https://icones.js.org/ for icon codes
			// You will need to install the corresponding icon set if it's not already included
			// `pnpm add @iconify-json/<icon-set-name>`
			url: "https://x.com",
		},*/
		{
			name: "QQ",
			icon: "fa7-brands:qq",
			url: "https://wpa.qq.com/msgrd?v=3&uin=1805875318&site=qq&menu=yes",
		},
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/1240890679",
		},
		{
			name: "Steam",
			icon: "fa7-brands:steam",
			url: "https://steamcommunity.com/id/Wuchang325/",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/Wuchang325",
		},
	],
});
