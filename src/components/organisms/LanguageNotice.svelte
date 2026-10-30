<script lang="ts">
/**
 * M3E LanguageNotice — 右上角语言提示。
 *
 * 站点只提供简体中文（siteConfig.lang 固定 zh_CN），本组件在访客浏览器首选语言
 * 非中文时弹一次提示，说明内容将统一以简体中文显示。关闭后写入 localStorage，
 * 同一访客不再打扰。由 siteConfig.languageNotice.enable 控制在 Layout 中是否挂载：
 * 关闭时不渲染该组件，也不产生任何客户端脚本（零负担）。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";

/** 关闭标记：写 1 后不再提示 */
const DISMISS_KEY = "language-notice-dismissed";
/** 首次出现延迟，等首屏与 Swup 初始化完成，避免抢占注意力 */
const SHOW_DELAY = 1500;

let visible = $state(false);
let browserLanguage = $state("");

/** 简体与繁体中文都算中文，不提示 */
function isChinese(tag: string): boolean {
	return /^zh(-|_|$)/i.test(tag);
}

onMount(() => {
	if (localStorage.getItem(DISMISS_KEY) === "1") return;

	const languages = navigator.languages?.length
		? navigator.languages
		: [navigator.language];
	const preferred = languages[0] ?? "";
	if (!preferred || isChinese(preferred)) return;

	browserLanguage = preferred;
	const timer = setTimeout(() => {
		visible = true;
	}, SHOW_DELAY);

	return () => clearTimeout(timer);
});

function dismiss() {
	visible = false;
	localStorage.setItem(DISMISS_KEY, "1");
}

const body = $derived(
	i18n(I18nKey.languageNoticeBody).replace("{language}", browserLanguage),
);
</script>

<div
    class="language-notice"
    class:visible={visible}
    role="status"
    aria-live="polite"
>
    <span class="language-notice__icon" aria-hidden="true">
        <Icon icon="material-symbols:translate-rounded"></Icon>
    </span>
    <div class="language-notice__content">
        <p class="language-notice__title">{i18n(I18nKey.languageNoticeTitle)}</p>
        <p class="language-notice__body">{body}</p>
    </div>
    <button
        type="button"
        class="language-notice__close"
        aria-label={i18n(I18nKey.languageNoticeDismiss)}
        onclick={dismiss}
    >
        <Icon icon="material-symbols:close-rounded"></Icon>
    </button>
</div>

<style lang="stylus">
.language-notice
    position: fixed
    /* 顶栏高 4rem，提示条贴在其下方 */
    top: calc(4rem + 0.75rem)
    right: 1rem
    z-index: 45
    display: flex
    align-items: flex-start
    gap: var(--m3e-space-2)
    /* Stylus 会把 min() 当内置函数求值，需原样输出 CSS 表达式 */
    max-width: unquote("min(22rem, calc(100vw - 2rem))")
    padding: var(--m3e-space-3)
    border-radius: var(--shape-corner-l)
    background: var(--surface-container-high)
    color: var(--on-surface)
    box-shadow: var(--m3e-elevation-2)
    opacity: 0
    visibility: hidden
    transform: translateY(-0.5rem) scale(0.98)
    pointer-events: none
    transition:
        opacity var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        visibility var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

    &.visible
        opacity: 1
        visibility: visible
        transform: none
        pointer-events: auto

    &__icon
        display: inline-flex
        flex-shrink: 0
        align-items: center
        justify-content: center
        width: 1.25rem
        height: 1.25rem
        margin-top: 0.125rem
        color: var(--primary)

        > :global(svg)
            width: 1.25rem
            height: 1.25rem

    &__content
        display: flex
        flex-direction: column
        gap: 0.125rem
        min-width: 0

    &__title
        margin: 0
        font: var(--m3e-type-label-large)
        font-weight: 700
        color: var(--on-surface)

    &__body
        margin: 0
        font: var(--m3e-type-body-small)
        color: var(--on-surface-variant)

    &__close
        display: inline-flex
        flex-shrink: 0
        align-items: center
        justify-content: center
        width: 1.75rem
        height: 1.75rem
        margin: -0.125rem -0.125rem 0 0
        padding: 0
        border: none
        border-radius: var(--shape-corner-full)
        background: transparent
        color: var(--on-surface-variant)
        cursor: pointer
        transition: background-color var(--m3e-duration-short) var(--m3e-easing-standard)

        &:hover
            background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")

        &:focus-visible
            outline: 2px solid var(--primary)
            outline-offset: 2px

        > :global(svg)
            width: 1.125rem
            height: 1.125rem

@media (max-width: 640px)
    .language-notice
        top: calc(4rem + 0.5rem)
        right: 0.75rem
        left: 0.75rem
        max-width: none
</style>
