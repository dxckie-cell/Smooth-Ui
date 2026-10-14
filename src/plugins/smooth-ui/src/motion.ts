import { ReactNative as RN } from "@vendetta/metro/common";

import { config } from "./settings";

let reduceMotion = false;

/** Tracks the system "reduce motion" setting. Returns a function that stops tracking. */
export function startMotion() {
	let sub: { remove?: () => void } | undefined;
	try {
		RN.AccessibilityInfo?.isReduceMotionEnabled?.().then((v: boolean) => {
			reduceMotion = !!v;
		});
		sub = RN.AccessibilityInfo?.addEventListener?.("reduceMotionChanged", (v: boolean) => {
			reduceMotion = !!v;
		}) as any;
	} catch {}

	return () => {
		try {
			sub?.remove?.();
		} catch {}
	};
}

export const motionAllowed = () => !(config.respectReduceMotion && reduceMotion);
