import channels from "./patches/channels";
import screens from "./patches/screens";
import taps from "./patches/taps";
import { config } from "./settings";

/** Starts a feature. Throws if Discord's internals aren't what it expects. */
export type Feature = () => { stop: () => void; detail?: string };

export type FeatureId = "taps" | "channels" | "screens";

export interface FeatureState {
	on: boolean;
	error?: string;
	detail?: string;
}

const FEATURES: Record<FeatureId, Feature> = { taps, channels, screens };

export const state: Record<FeatureId, FeatureState> = {
	taps: { on: false },
	channels: { on: false },
	screens: { on: false },
};

const active: Partial<Record<FeatureId, () => void>> = {};

/** Starts / stops features so they match the settings. Safe to call any time. */
export function sync() {
	for (const id of Object.keys(FEATURES) as FeatureId[]) {
		const want = !!config[id];

		if (want && !active[id]) {
			try {
				const { stop, detail } = FEATURES[id]();
				active[id] = stop;
				state[id] = { on: true, detail };
			} catch (e: any) {
				// one feature failing (Discord changed something) must not stop the others
				state[id] = { on: false, error: String(e?.message ?? e) };
				console.warn(`[Smooth UI] ${id} failed`, e);
			}
		} else if (!want) {
			try {
				active[id]?.();
			} catch {}
			delete active[id];
			state[id] = { on: false };
		}
	}
}

export function stopAll() {
	for (const id of Object.keys(active) as FeatureId[]) {
		try {
			active[id]?.();
		} catch {}
		delete active[id];
		state[id] = { on: false };
	}
}
