import type { FooterConfig } from "@/types/footerConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 页脚自定义 HTML 注入配置。
 * 开启后将读取 src/config/FooterConfig.html 文件内容并注入到页脚版权信息上方。
 * 关闭时（enable: false）零额外 DOM 占位、零文件读取开销。
 */
export const footerConfig: FooterConfig = withUserConfig("footer", {
	enable: true,
	// 页脚随机一言（https://hitokoto.cn）。会向第三方接口发起一次请求；
	// 关闭后不渲染占位、不输出脚本、零网络请求。
	hitokoto: {
		enable: true,
		categories: "", // 留空 = 全部分类；"k" 哲学 / "d" 文学 / "i" 诗词 / "l" 抖机灵
		timeout: 4000,
	},
});
