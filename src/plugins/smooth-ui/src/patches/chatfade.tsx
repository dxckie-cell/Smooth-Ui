import { FluxDispatcher, React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { semanticColors } from "@vendetta/ui";

import type { Feature } from "../features";
import { findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// the view Discord renders for an open channel
const TARGET = "ChatViewWrapperBase";

// one chat is on screen at a time, so a single shared value drives the fade
let opacity: any;
const getOpacity = () => (opacity ??= new RN.Animated.Value(1));

/** Dips the chat to almost transparent, then eases it back in. */
let lastFade = 0;
let lastKey = "";
export function fadeNow(from = 0.1) {
	if (!motionAllowed()) return;
	lastFade = Date.now();
	const o = getOpacity();
	o.stopAnimation?.();
	o.setValue(from);
	RN.Animated.timing(o, {
		toValue: 1,
		duration: clampSpeed(config.speed) + 100,
		easing: RN.Easing.out(RN.Easing.cubic),
		useNativeDriver: true,
	}).start();
}

// first of these theme colours this Discord build actually has; the cover must be opaque to be seen
const COVER_TOKENS = [
	"CHAT_BACKGROUND",
	"BG_BASE_PRIMARY",
	"BACKGROUND_PRIMARY",
	"BACKGROUND_BASE_LOWEST",
	"BACKGROUND_MOBILE_PRIMARY",
	"BG_BASE_TERTIARY",
	"BACKGROUND_SECONDARY",
];
let overlayStyle: any;
const getOverlayStyle = () => {
	if (overlayStyle) return overlayStyle;
	const token = COVER_TOKENS.find(t => (semanticColors as any)[t] != null);
	return (overlayStyle = stylesheet.createThemedStyleSheet({
		fill: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: 100,
			elevation: 100,
			backgroundColor: token ? (semanticColors as any)[token] : "#000000",
		},
	}).fill);
};

/**
 * A cover in the chat's background colour, laid over it (absolute, so it takes no space in the
 * layout) and faded out, which reads as the chat fading in. Wrapping the chat in an animated view
 * instead broke Discord's keyboard layout.
 */
function Cover() {
	return React.createElement(RN.Animated.View, {
		pointerEvents: "none",
		style: [getOverlayStyle(), { opacity: getOpacity().interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
	});
}

/** Appends the cover to the children of an element, if it has plain children to append to. */
function withCover(el: any) {
	if (!React.isValidElement(el) || el.type === React.Fragment) return el;
	const kids = (el as any).props?.children;
	if (typeof kids === "function") return el;
	const list = kids == null ? [] : Array.isArray(kids) ? kids : [kids];
	return React.cloneElement(el as any, undefined, ...list, React.createElement(Cover, { key: "smooth-ui-cover" }));
}

/** Fades Discord's chat in when you switch channels, with React Native's Animated (native driver). */
const chatFade: Feature = () => {
	if (typeof (FluxDispatcher as any)?.dispatch !== "function") {
		throw new Error("Couldn't find Discord's Flux dispatcher");
	}
	const target = findPatchTarget(TARGET);
	if (!target) throw new Error(`Couldn't find ${TARGET}`);

	const wrap = (_args: any[], ret: any) => withCover(ret);
	const stops: (() => void)[] = [];
	if (typeof target.value === "function" && target.value.prototype?.isReactComponent) {
		stops.push(after("render", target.value.prototype, wrap));
	} else {
		stops.push(after(target.key, target.parent, wrap));
	}
	stops.push(before("dispatch", FluxDispatcher as any, (args: any[]) => {
		const e = args[0];
		if (e?.type !== "CHANNEL_SELECT") return;
		try {
			// Discord can dispatch the same select twice in a row; a second fade looks like a flicker
			const key = `${e.guildId}/${e.channelId}`;
			if (key === lastKey && Date.now() - lastFade < 1500) return;
			lastKey = key;
			fadeNow();
		} catch {}
	}));

	return { stop: () => stops.forEach(s => s()) };
};

export default chatFade;
