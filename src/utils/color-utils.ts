/**
 * 颜色工具：把任意 CSS 颜色（含 `oklch()` 等现代语法）解析成 `"r,g,b"` 三元组。
 *
 * canvas 的 `fillStyle` / `strokeStyle` 只接受具体色值，直接读 `--primary`
 * 拿到的是 `oklch(...)` 字符串，没法拼进 `rgba()`。这里借 1×1 canvas 采样，
 * 让浏览器自己做色彩空间转换，避免手写颜色解析。
 *
 * 采样失败（浏览器不认识该色值时会静默保留上一次的黑色）时返回兜底色。
 */
export function toRgbTriplet(cssColor: string, fallback: string): string {
	const probe = document.createElement("canvas");
	probe.width = 1;
	probe.height = 1;
	const ctx = probe.getContext("2d", { willReadFrequently: true });
	if (!ctx) return fallback;

	ctx.fillStyle = "#000000";
	ctx.fillStyle = cssColor;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

	// 赋了不认识的色值时 fillStyle 会保留前值，采样结果就是纯黑
	if (r === 0 && g === 0 && b === 0 && !/^#?0{3,6}$/i.test(cssColor.trim())) {
		return fallback;
	}
	return `${r},${g},${b}`;
}

/** 读取主题主色并转成 RGB 三元组；`color` 非 `"theme"` 时原样返回 */
export function resolveCanvasColor(color: string, fallback: string): string {
	if (color !== "theme") return color;
	const primary = getComputedStyle(document.documentElement).getPropertyValue(
		"--primary",
	);
	return toRgbTriplet(primary, fallback);
}
