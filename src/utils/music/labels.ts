import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { MusicErrorCode } from "@/types/musicConfig";

/** 播放器 UI 文案集合（侧栏形态与悬浮形态共用） */
export interface MusicLabels {
	previous: string;
	play: string;
	pause: string;
	next: string;
	mute: string;
	unmute: string;
	playbackMode: string;
	modeSequence: string;
	modeRepeatOne: string;
	modeShuffle: string;
	progress: string;
	volume: string;
	showPlaylist: string;
	hidePlaylist: string;
	empty: string;
	loading: string;
	notRequested: string;
	nowPlaying: string;
	errors: Record<MusicErrorCode, string>;
}

export function buildMusicLabels(): MusicLabels {
	return {
		previous: i18n(I18nKey.musicPrevious),
		play: i18n(I18nKey.musicPlay),
		pause: i18n(I18nKey.musicPause),
		next: i18n(I18nKey.musicNext),
		mute: i18n(I18nKey.musicMute),
		unmute: i18n(I18nKey.musicUnmute),
		playbackMode: i18n(I18nKey.musicPlaybackMode),
		modeSequence: i18n(I18nKey.musicModeSequence),
		modeRepeatOne: i18n(I18nKey.musicModeRepeatOne),
		modeShuffle: i18n(I18nKey.musicModeShuffle),
		progress: i18n(I18nKey.musicProgress),
		volume: i18n(I18nKey.musicVolume),
		showPlaylist: i18n(I18nKey.musicShowPlaylist),
		hidePlaylist: i18n(I18nKey.musicHidePlaylist),
		empty: i18n(I18nKey.musicEmpty),
		loading: i18n(I18nKey.musicLoading),
		notRequested: i18n(I18nKey.musicNotRequested),
		nowPlaying: i18n(I18nKey.musicNowPlaying),
		errors: {
			"empty-playlist": i18n(I18nKey.musicErrorEmptyPlaylist),
			"source-unavailable": i18n(I18nKey.musicErrorSourceUnavailable),
			"autoplay-blocked": i18n(I18nKey.musicErrorAutoplayBlocked),
			"invalid-track": i18n(I18nKey.musicErrorInvalidTrack),
		},
	};
}
