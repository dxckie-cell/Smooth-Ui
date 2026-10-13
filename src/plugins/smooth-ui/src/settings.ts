import { storage } from "@vendetta/plugin";

export type ScreenStyle = "fade" | "slide-fade";

export interface Config {
	/** fade/animate whatever changes on screen right after you tap something */
	taps: boolean;
	/** cross-fade when switching channels / loading messages */
	channels: boolean;
	/** experimental: override Discord's screen push/pop animation */
	screens: boolean;
	/** also animate things moving and resizing, not only fading */
	moves: boolean;
	/** skip everything when the system "reduce motion" setting is on */
	respectReduceMotion: boolean;
	/** animation length in ms */
	speed: number;
	screenStyle: ScreenStyle;
}

export const DEFAULTS: Config = {
	taps: true,
	channels: true,
	screens: false,
	moves: false,
	respectReduceMotion: true,
	speed: 200,
	screenStyle: "slide-fade",
};

export const config = storage as unknown as Config;

export function initConfig() {
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		if (config[k] === undefined) (config as any)[k] = DEFAULTS[k];
	}
}

export function resetConfig() {
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		(config as any)[k] = DEFAULTS[k];
	}
}

export function clampSpeed(ms: unknown) {
	const n = Number(ms);
	return Math.max(80, Math.min(600, Number.isFinite(n) && n > 0 ? n : DEFAULTS.speed));
}
