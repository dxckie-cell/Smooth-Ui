import { find } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import type { Feature } from "../features";
import { clampSpeed, config } from "../settings";

const SLIDE = 24;

const nameOf = (v: any) => (typeof v === "function" ? v.displayName ?? v.name : undefined);

/** Finds a component by function/class name among every module's exports. */
function findComponent(wanted: string): any {
	let hit: any;
	find((m: any) => {
		if (hit || !m || (typeof m !== "object" && typeof m !== "function")) return false;
		try {
			for (const k of Object.keys(m)) {
				const v = m[k];
				if (nameOf(v) === wanted) hit = v;
				else if (v && typeof v === "object" && nameOf(v.type) === wanted) hit = v.type;
				if (hit) return true;
			}
		} catch {}
		return false;
	});
	return hit;
}

// rebuilt only when the style / speed setting changes
let cached: { key: string; interpolator: any; spec: any } | undefined;
function animation() {
	const style = config.screenStyle;
	const duration = clampSpeed(config.speed) + 60;
	const key = `${style}:${duration}`;
	if (cached?.key === key) return cached;

	const A = RN.Animated;
	const timing = {
		animation: "timing",
		config: { duration, easing: RN.Easing.out(RN.Easing.cubic) },
	};
	const clamp = "clamp";

	const interpolator = style === "fade"
		? ({ current }: any) => ({
			cardStyle: {
				opacity: current.progress.interpolate({
					inputRange: [0, 1],
					outputRange: [0, 1],
					extrapolate: clamp,
				}),
			},
		})
		: ({ current, next }: any) => ({
			cardStyle: {
				opacity: current.progress.interpolate({
					inputRange: [0, 1],
					outputRange: [0, 1],
					extrapolate: clamp,
				}),
				transform: [{
					translateX: A.add(
						current.progress.interpolate({
							inputRange: [0, 1],
							outputRange: [SLIDE, 0],
							extrapolate: clamp,
						}),
						// the screen underneath drifts left a little as the new one arrives
						next
							? next.progress.interpolate({
								inputRange: [0, 1],
								outputRange: [0, -SLIDE / 2],
								extrapolate: clamp,
							})
							: 0,
					),
				}],
			},
		});

	return (cached = { key, interpolator, spec: { open: timing, close: timing } });
}

/** react-navigation's JS stack (Discord's main push/pop navigator). */
function tweakStack(descriptors: any) {
	if (!descriptors || typeof descriptors !== "object") return;
	const { interpolator, spec } = animation();
	for (const key in descriptors) {
		const o = descriptors[key]?.options;
		if (!o || typeof o !== "object") continue;
		// leave modals and bottom sheets (vertical gestures) alone
		if (o.presentation === "modal" || o.presentation === "transparentModal") continue;
		if (typeof o.gestureDirection === "string" && o.gestureDirection.startsWith("vertical")) continue;
		o.cardStyleInterpolator = interpolator;
		o.transitionSpec = spec;
	}
}

/** react-native-screens based stack: only the native "fade" animation exists. */
function tweakNative(descriptors: any) {
	if (!descriptors || typeof descriptors !== "object" || config.screenStyle !== "fade") return;
	for (const key in descriptors) {
		const o = descriptors[key]?.options;
		if (!o || typeof o !== "object") continue;
		if (o.presentation && o.presentation !== "card" && o.presentation !== "push") continue;
		o.animation = "fade";
		o.animationDuration = clampSpeed(config.speed) + 60;
	}
}

/** Overrides the screen push/pop animation (experimental, Discord internals vary). */
const screens: Feature = () => {
	const stops: (() => void)[] = [];
	const found: string[] = [];

	const cardStack = findComponent("CardStack");
	if (cardStack && typeof cardStack.getDerivedStateFromProps === "function") {
		stops.push(before("getDerivedStateFromProps", cardStack, (args: any[]) => {
			try {
				tweakStack(args[0]?.descriptors);
			} catch {}
		}));
		found.push("JS stack");
	}

	const nativeStack = findComponent("NativeStackView");
	if (nativeStack) {
		// a function component: patch it where it lives
		const parent = findParent(nativeStack);
		if (parent) {
			stops.push(before(parent[1], parent[0], (args: any[]) => {
				try {
					tweakNative(args[0]?.descriptors);
				} catch {}
			}));
			found.push("native stack (fade only)");
		}
	}

	if (!stops.length) {
		throw new Error("Couldn't find Discord's navigation stack in this version");
	}
	return { stop: () => stops.forEach(s => s()), detail: `Hooked ${found.join(" + ")}` };
};

/** [exportsObject, key] holding `fn`, so it can be patched in place. */
function findParent(fn: any): [any, string] | undefined {
	let hit: [any, string] | undefined;
	find((m: any) => {
		if (hit || !m || (typeof m !== "object" && typeof m !== "function")) return false;
		try {
			for (const k of Object.keys(m)) {
				if (m[k] === fn) {
					hit = [m, k];
					return true;
				}
			}
		} catch {}
		return false;
	});
	return hit;
}

export default screens;
