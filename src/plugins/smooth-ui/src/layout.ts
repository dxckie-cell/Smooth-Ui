import { ReactNative as RN } from "@vendetta/metro/common";

import { diag } from "./diag";
import { clampSpeed, config } from "./settings";

let reduceMotion = false;
let lastAt = 0;

/** Turns on LayoutAnimation for Android's old architecture and tracks "reduce motion". */
export function startLayout() {
	let sub: { remove?: () => void } | undefined;
	try {
		RN.UIManager?.setLayoutAnimationEnabledExperimental?.(true);
	} catch {}
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

/**
 * Makes the next layout pass animate: views that appear fade in, views that
 * disappear fade out (a cross-fade when one replaces the other), and, if
 * "move animations" is on, views that move or resize glide to their new spot.
 */
export function animateNext(force = false) {
	if (!force) {
		if (config.respectReduceMotion && reduceMotion) return;
		const now = Date.now();
		if (now - lastAt < 30) return; // several calls in one frame are redundant
		lastAt = now;
	}

	try {
		diag.calls++;
		RN.LayoutAnimation.configureNext({
			duration: clampSpeed(config.speed),
			create: { type: "easeInEaseOut", property: "opacity" },
			delete: { type: "easeInEaseOut", property: "opacity" },
			...(config.moves ? { update: { type: "easeInEaseOut" } } : {}),
		});
	} catch (e: any) {
		diag.lastError = String(e?.message ?? e);
	}
}
