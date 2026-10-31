/**
 * 页脚配置类型。
 */

/**
 * 随机一言（https://hitokoto.cn）配置。
 *
 * 关闭时（`enable: false`）不渲染占位元素、不输出脚本、不产生任何网络请求。
 */
export interface HitokotoConfig {
	/** 是否启用（默认 true） */
	enable?: boolean;
	/**
	 * 一言分类，逗号分隔；留空表示全部分类。
	 * a 动画 / b 漫画 / c 游戏 / d 文学 / e 原创 / f 来自网络
	 * g 其他 / h 影视 / i 诗词 / j 网易云 / k 哲学 / l 抖机灵
	 */
	categories?: string;
	/** 请求超时毫秒 (1000 ~ 15000，默认 4000) */
	timeout?: number;
}

/**
 * 页脚自定义 HTML 注入配置类型。
 */
export interface FooterConfig {
	/**
	 * 是否启用自定义页脚 HTML 注入。
	 * 开启后将读取 src/config/FooterConfig.html 中的内容注入到页脚；
	 * 关闭时（false）满足零额外负担，不进行文件读取与额外 DOM 渲染。
	 */
	enable: boolean;
	/** 页脚随机一言 */
	hitokoto?: HitokotoConfig;
}
