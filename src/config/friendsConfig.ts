import type { FriendsConfig } from "../types/friendsConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

export const friendsConfig: FriendsConfig = withUserConfig("friends", {
	enable: true,
	title: "$t:friends",
	description: "$t:friendsBanner",
	// 友链列表下方的「申请友链」指引卡片：展示本站信息与申请要求，引导访客在评论区留言。
	applyGuide: true,
	// 友链页评论区；关闭后不渲染评论组件，也不加载对应脚本。
	comment: true,
	// 申请要求（站点自有内容，按需增删）
	applyRequirements: [
		"站点内容以原创为主，不接受纯采集、纯导航或长期停更的站点",
		"已先将本站加入友链，且链接处于可访问状态",
		"站点可正常访问，无强制弹窗广告与恶意跳转",
	],
	// 指引卡片展示的本站信息。留空的字段自动回退到 profileConfig / siteConfig。
	siteInfo: {
		name: "", // 留空 = profileConfig.name
		url: "", // 留空 = siteConfig.site
		// 用 public/ 下的静态头像，直接以站点域名对外提供；
		// 也可以填完整 URL（如 https://cdn.example.com/avatar.webp）
		avatar: "/images/avatar.webp",
		// 留空 = profileConfig.bio；友链场景建议换成一句话简介
		description: "无论升起在海平面，还是坠入于深渊之中...",
	},
});
