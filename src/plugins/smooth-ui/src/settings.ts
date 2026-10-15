import { storage } from "@vendetta/plugin";

export interface Config {
	/** settings schema version, bumped when defaults change */
	version: number;
	/** fade the chat in when you switch channels */
	chatFade: boolean;
	/** the input bar squeezes and flashes when you send a message */
	sendPulse: boolean;
	/** skip animations when the system "reduce motion" setting is on */
	respectReduceMotion: boolean;
	/** animation length in ms */
	speed: number;
}

export const DEFAULTS: Config = {
	version: 9,
	chatFade: true,
	sendPulse: true,
	respectReduceMotion: true,
	speed: 2000,
};

export const config = storage as unknown as Config;

export function initConfig() {
	const from = config.version ?? 0;
	for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
		if (config[k] === undefined) (config as any)[k] = DEFAULTS[k];
	}
	// older versions had features that were removed
	if (from < 9) {
		for (const k of ["taps", "channels", "moves", "messagePop", "screens", "screenStyle", "debugBorder"]) {
			delete (config as any)[k];
		}
	}
	if (from < 6) config.speed = DEFAULTS.speed;
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
