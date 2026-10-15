import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { inspectChat } from "../inspect";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

const TARGETS = ["ChatView", "ChannelMessages"];

// one chat is on screen at a time, so a single shared value drives the fade
/** the on-screen chat view, so the inspector can read the React tree under it */
export let chatRef: any = null;
export const setChatRef = (r: any) => {
	chatRef = r;
};
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

function Fade({ children }: { children?: any }) {
	diag.fadeRenders++;
	// once the chat is up, look for its message rows (the rows' names aren't known in advance);
	// messages load a moment after the chat opens, so retry a few times
	React.useEffect(() => {
		diag.refState = chatRef ? "set at mount" : "empty at mount";
		if (!config.messagePop) return;
		const timers = [1500, 4000, 9000].map(ms =>
			setTimeout(() => {
				try {
					if (!/Message rows \([1-9]/.test(diag.inspectText)) inspectChat(chatRef);
				} catch {}
			}, ms)
		);
		return () => timers.forEach(clearTimeout);
	}, []);
	return (
		<RN.Animated.View
			ref={setChatRef}
			style={[
				{ flex: 1, opacity: getOpacity() },
				config.debugBorder && { borderWidth: 3, borderColor: "#ff0000" },
			]}
		>
			{children}
		</RN.Animated.View>
	);
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
		ret == null || ret === false ? ret : React.createElement(Fade, null, ret);

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
