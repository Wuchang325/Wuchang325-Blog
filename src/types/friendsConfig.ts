import type { PageMeta } from "./pageMeta.ts";

/**
 * 友链页展示的「本站信息」。
 * 留空的字段自动回退到 profileConfig / siteConfig，填了则以这里为准。
 */
export interface FriendSiteInfo {
	/** 站点名称；留空取 profileConfig.name */
	name?: string;
	/** 站点链接；支持完整 URL 或站内路径（/friends/），留空取 siteConfig.site */
	url?: string;
	/**
	 * 头像地址。支持完整 URL（https://cdn.example.com/a.png）或站内路径（/images/avatar.webp）；
	 * 站内路径会自动补成站点域名，避免 dev 环境下解析出 Vite 的 /@fs/ 本地路径。
	 * 留空则回退到 profileConfig.avatar。
	 */
	avatar?: string;
	/** 站点描述；留空取 profileConfig.bio。友链场景建议写一句话简介 */
	description?: string;
}

export interface FriendsConfig extends PageMeta {
	/** 是否在友链列表下方展示「申请友链」指引卡片（默认 true） */
	applyGuide?: boolean;
	/** 是否展示评论区（默认 true） */
	comment?: boolean;
	/**
	 * 申请要求条目，逐条渲染为列表；留空则不渲染该段。
	 * 属于站点自有内容（不走 i18n），按需增删。
	 */
	applyRequirements?: string[];
	/** 指引卡片中展示的本站信息，留空的字段回退到 profileConfig / siteConfig */
	siteInfo?: FriendSiteInfo;
}
