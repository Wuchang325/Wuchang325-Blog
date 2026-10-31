/**
 * 音乐播放器的展示形态（类型定义在 types 层，这里只做读写与 DOM 应用）。
 *
 * 两种形态共用同一个 music runtime（`getMusicRuntime` 是模块级单例），
 * 所以无论显示哪种，播放进度与播放状态始终一致。
 */
import type { MusicForm } from "@/types/musicConfig";

export type { MusicForm };

export const MUSIC_FORMS: readonly MusicForm[] = ["sidebar", "floating"];

export const MUSIC_FORM_KEY = "music-form";
export const MUSIC_FORM_CHANGE_EVENT = "music-form:change";

export function isMusicForm(value: unknown): value is MusicForm {
	return (
		typeof value === "string" &&
		(MUSIC_FORMS as readonly string[]).includes(value)
	);
}

/** 读取访客偏好；未存过返回 null，由调用方回退到站点配置 */
export function readMusicForm(): MusicForm | null {
	try {
		const stored = localStorage.getItem(MUSIC_FORM_KEY);
		return isMusicForm(stored) ? stored : null;
	} catch {
		return null;
	}
}

/**
 * 把形态落到 DOM：`data-music-form` 挂在 <html> 上，
 * CSS 据此在侧栏卡片与悬浮条之间切换显隐。
 */
export function applyMusicForm(form: MusicForm): void {
	document.documentElement.dataset.musicForm = form;
	const widget = document.querySelector<HTMLElement>("[data-music-widget]");
	if (widget) widget.hidden = form === "floating";
}

export function setMusicForm(form: MusicForm): void {
	try {
		localStorage.setItem(MUSIC_FORM_KEY, form);
	} catch {
		// 隐私模式下写入失败不影响本次生效
	}
	applyMusicForm(form);
	window.dispatchEvent(
		new CustomEvent(MUSIC_FORM_CHANGE_EVENT, { detail: { form } }),
	);
}
