import { storage } from "@vendetta/plugin";

export type ScreenStyle = "fade" | "slide-fade";

export interface Config {
	/** settings schema version, bumped when defaults change */
	version: number;
	/** fade the chat in when you switch channels */
	chatFade: boolean;
	/** new messages ease in instead of popping in */
	messagePop: boolean;
	/** experimental: override Discord's screen push/pop animation */
	screens: boolean;
	/** skip animations when the system "reduce motion" setting is on */
	respectReduceMotion: boolean;
	/** animation length in ms */
	speed: number;
	screenStyle: ScreenStyle;
	/** debug: draw a red outline around the area the channel fade controls */
	debugBorder: boolean;
}

export const DEFAULTS: Config = {
	version: 5,
	chatFade: false,
	messagePop: false,
	screens: false,
	respectReduceMotion: true,
	speed: 200,
	// Discord uses native stacks, which only support fade
	screenStyle: "fade",
	debugBorder: false,
};

export const config = storage as unknown as Config;

export function initConfig() {
	const from = config.version ?? 0;
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		if (config[k] === undefined) (config as any)[k] = DEFAULTS[k];
	}
	if (from < 3) {
		// v3: the LayoutAnimation features (taps, channels, moves) were removed;
		// they have no visible effect on the new architecture
		for (const k of ["taps", "channels", "moves"]) delete (config as any)[k];
	}
	// v4: Discord's pages use native stacks, where only fade works
	if (from < 4) config.screenStyle = "fade";
	config.version = DEFAULTS.version;
}

export function resetConfig() {
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		(config as any)[k] = DEFAULTS[k];
	}
}

export function clampSpeed(ms: unknown) {
	const n = Number(ms);
	return Math.max(80, Math.min(3000, Number.isFinite(n) && n > 0 ? n : DEFAULTS.speed));
}
