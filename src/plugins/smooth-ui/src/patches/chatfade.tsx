import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

const TARGETS = ["ChatView", "ChannelMessages"];

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
		useNativeDriver: false, // the opacity is applied through state, see Fade
	}).start();
	diag.fades++;
}

/**
 * Fades the chat by merging an opacity into the style of the element ChatView returns. An extra
 * wrapper view around the chat broke Discord's keyboard handling (gap above the keyboard, content
 * jumping), so nothing is added to the layout. The opacity is driven from JS and applied through
 * state: the wrapper re-renders each frame, but the chat's own children are the same elements and
 * React skips them.
 */
function Fade({ el }: { el: any }) {
	diag.fadeRenders++;
	const o = getOpacity();
	const [v, setV] = React.useState<number>((o as any).__getValue?.() ?? 1);
	React.useEffect(() => {
		const id = o.addListener(({ value }: { value: number }) => setV(value));
		return () => o.removeListener(id);
	}, []);

	const extra = [v < 1 && { opacity: v }, config.debugBorder && { borderWidth: 3, borderColor: "#ff0000" }]
		.filter(Boolean);
	if (!extra.length) return el;
	const base = el.props?.style;
	const merged = Object.assign({}, ...extra);
	return React.cloneElement(el, {
		style: Array.isArray(base) ? [...base, merged] : base ? [base, merged] : merged,
	});
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

	const wrap = (_args: any[], ret: any) =>
		React.isValidElement(ret) && ret.type !== React.Fragment ? React.createElement(Fade, { el: ret }) : ret;

	const stops: (() => void)[] = [];
	const { parent, key, value } = target;
	if (typeof value === "function" && value.prototype?.isReactComponent) {
		stops.push(after("render", value.prototype, wrap));
	} else {
		stops.push(after(key, parent, wrap));
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

	return {
		stop: () => stops.forEach(s => s()),
		detail: `Hooked ${name} (${describe(value)})`,
	};
};

export default chatFade;
