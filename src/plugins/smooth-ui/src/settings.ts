import { storage } from "@vendetta/plugin";

export type ScreenStyle = "fade" | "slide-fade";

export interface Config {
	/** settings schema version, bumped when defaults change */
	version: number;
	/** fade the chat in when you switch channels */
	chatFade: boolean;
	/** experimental: override Discord's screen push/pop animation */
	screens: boolean;
	/** skip animations when the system "reduce motion" setting is on */
	respectReduceMotion: boolean;
	/** animation length in ms */
	speed: number;
	screenStyle: ScreenStyle;
}

export const DEFAULTS: Config = {
	version: 3,
	chatFade: false,
	screens: false,
	respectReduceMotion: true,
	speed: 200,
	screenStyle: "slide-fade",
};

export const config = storage as unknown as Config;

export function initConfig() {
	const old = (config.version ?? 0) < 3;
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		if (config[k] === undefined) (config as any)[k] = DEFAULTS[k];
	}
	if (old) {
		// v3: the LayoutAnimation features (taps, channels, moves) were removed;
		// they have no visible effect on the new architecture
		for (const k of ["taps", "channels", "moves"]) delete (config as any)[k];
		config.version = 3;
	}
}

export function resetConfig() {
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		(config as any)[k] = DEFAULTS[k];
	}
}

export function clampSpeed(ms: unknown) {
	const n = Number(ms);
	return Math.max(80, Math.min(1200, Number.isFinite(n) && n > 0 ? n : DEFAULTS.speed));
}
