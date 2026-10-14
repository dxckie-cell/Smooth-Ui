import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// one chat is on screen at a time, so a single shared value drives the fade
let opacity: any;
const getOpacity = () => (opacity ??= new RN.Animated.Value(1));

/** Dips the chat to almost transparent, then eases it back in. */
export function fadeNow() {
	if (!motionAllowed()) return;
	const o = getOpacity();
	o.stopAnimation?.();
	o.setValue(0.1);
	RN.Animated.timing(o, {
		toValue: 1,
		duration: clampSpeed(config.speed) + 100,
		easing: RN.Easing.out(RN.Easing.cubic),
		useNativeDriver: true,
	}).start();
	diag.fades++;
}

function Fade({ children }: { children?: any }) {
	return (
		<RN.Animated.View style={{ flex: 1, opacity: getOpacity() }}>
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
	const target = findPatchTarget("ChannelMessages");
	if (!target) throw new Error("Couldn't find Discord's ChannelMessages component");

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
		if (args[0]?.type !== "CHANNEL_SELECT") return;
		try {
			fadeNow();
		} catch {}
	}));

	return {
		stop: () => stops.forEach(s => s()),
		detail: `Hooked ChannelMessages (${describe(value)})`,
	};
};

export default chatFade;
