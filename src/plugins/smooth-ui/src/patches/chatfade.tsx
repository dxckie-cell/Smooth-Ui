import { FluxDispatcher, React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { semanticColors } from "@vendetta/ui";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget, nameOf } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// ChatViewWrapperBase is the view inside ChatView; ChatView itself may return a non-view root
const TARGETS = ["ChatView", "ChannelMessages"];
const INNER = "ChatViewWrapperBase";

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
	diag.fades++;
}

const animatedCache = new Map<any, any>();
const animatedOf = (type: any) => {
	let a = animatedCache.get(type);
	if (!a) animatedCache.set(type, a = RN.Animated.createAnimatedComponent(type));
	return a;
};

/** Can this element take an animated opacity? (an RN view, or something that already takes a style) */
const viewLike = (el: any) =>
	React.isValidElement(el) && el.type !== React.Fragment && typeof el.type !== "string"
	&& (el.type === RN.View || (el as any).props?.style !== undefined);

/**
 * Fades the chat by animating the opacity of the element ChatView returns, turned into an animated
 * version of itself with the same props. An extra wrapper view around the chat broke Discord's
 * keyboard handling (gap above the keyboard, content jumping), so nothing is added to the layout.
 */
function Fade({ el, name }: { el: any; name: string }) {
	diag.fadeRenders++;
	const type = (el as any).type;
	const style = (el as any).props?.style;
	diag.fadeRoot = `${name} returns ${nameOf(type) || nameOf(type?.type) || nameOf(type?.render) || (typeof type === "object" ? "object" : "anonymous")}, style ${style !== undefined ? "yes" : "no"}`;
	const A = animatedOf(type);
	return React.createElement(A, {
		...(el as any).props,
		ref: (el as any).ref,
		style: [style, { opacity: getOpacity() }, config.debugBorder && { borderWidth: 3, borderColor: "#ff0000" }],
	});
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
	diag.coverColor = token ?? "none found, using black";
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
 * Fallback when the chat's root can't take an opacity: a cover in the chat's background colour,
 * laid over it (absolute, so it takes no space in the layout) and faded out, which reads as the
 * chat fading in.
 */
function Cover() {
	diag.fadeRenders++;
	const cover = React.createElement(RN.Animated.View, {
		pointerEvents: "none",
		style: [getOverlayStyle(), { opacity: getOpacity().interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
	});
	if (!config.debugBorder) return cover;
	// with the outline on, show where the cover is even while it is fully transparent
	return React.createElement(
		RN.View,
		{
			pointerEvents: "none",
			style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 101, borderWidth: 3, borderColor: "#ff0000" },
		},
		cover,
	);
}

/** Appends the cover to the children of an element, if it has plain children to append to. */
function withCover(el: any) {
	if (!React.isValidElement(el) || el.type === React.Fragment) return el;
	const kids = (el as any).props?.children;
	if (typeof kids === "function") return el;
	const list = kids == null ? [] : Array.isArray(kids) ? kids : [kids];
	diag.fadeRoot = `cover added inside ${nameOf((el as any).type) || "anonymous"} (${list.length} children)`;
	return React.cloneElement(el as any, undefined, ...list, React.createElement(Cover, { key: "smooth-ui-cover" }));
}

/**
 * Fades Discord's chat list in when you switch channels. Uses React Native's
 * Animated (the same thing the Local Pins chips use), which works on the new
 * architecture where LayoutAnimation doesn't.
 */
const chatFade: Feature = () => {
	if (typeof (FluxDispatcher as any)?.dispatch !== "function") {
		throw new Error("Couldn't find Discord's Flux dispatcher");
	}
	// ChatView is what Discord renders for an open channel (found with the probe);
	// ChannelMessages is the older guess, kept as a fallback
	let target: ReturnType<typeof findPatchTarget>;
	let name = "";
	for (name of TARGETS) {
		target = findPatchTarget(name);
		if (target) break;
	}
	if (!target) throw new Error(`Couldn't find any of: ${TARGETS.join(", ")}`);

	// the outer component's root gets the fade when it can; otherwise the view inside it does
	let outerApplied = false;
	const wrapFor = (label: string, inner: boolean) => (_args: any[], ret: any) => {
		if (inner && !outerApplied && !viewLike(ret)) return withCover(ret);
		if (!viewLike(ret) || (inner && outerApplied)) {
			// say what was skipped, so the status page can show why nothing faded
			if (!(inner && outerApplied)) {
				const t = ret?.type;
				diag.fadeSkipped[label] = React.isValidElement(ret)
					? `${nameOf(t) || nameOf(t?.type) || nameOf(t?.render) || (typeof t === "string" ? `<${t}>` : "anonymous")}, style ${ret.props?.style !== undefined ? "yes" : "no"}`
					: ret == null ? "null" : Array.isArray(ret) ? "array" : typeof ret;
			}
			return ret;
		}
		if (!inner) outerApplied = true;
		return React.createElement(Fade, { el: ret, name: label });
	};

	const stops: (() => void)[] = [];
	const hook = (t: NonNullable<typeof target>, label: string, inner: boolean) => {
		const wrap = wrapFor(label, inner);
		if (typeof t.value === "function" && t.value.prototype?.isReactComponent) {
			stops.push(after("render", t.value.prototype, wrap));
		} else {
			stops.push(after(t.key, t.parent, wrap));
		}
	};
	const { value } = target;
	hook(target, name, false);
	const innerTarget = findPatchTarget(INNER);
	if (innerTarget) hook(innerTarget, INNER, true);
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

	return {
		stop: () => stops.forEach(s => s()),
		detail: `Hooked ${name} (${describe(value)})${innerTarget ? `, ${INNER}` : ""}`,
	};
};

export default chatFade;
