import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// Discord draws the message list itself, where plugins can't reach it, but the input bar is an
// ordinary component. It gets a small squeeze-and-flash when your message is sent.
const TARGET = "ChatInputGuardWrapper";

let pulse: any;
const getPulse = () => (pulse ??= new RN.Animated.Value(0));
let lastPlay = 0;

function play() {
	if (!motionAllowed()) return;
	const now = Date.now();
	if (now - lastPlay < 350) return; // the optimistic message and the server copy arrive back to back
	lastPlay = now;
	const p = getPulse();
	p.stopAnimation?.();
	p.setValue(0);
	RN.Animated.timing(p, {
		toValue: 1,
		duration: Math.min(clampSpeed(config.speed), 700),
		easing: RN.Easing.out(RN.Easing.cubic),
		useNativeDriver: true,
	}).start();
	diag.sendPulses++;
}

function Pulse({ children }: { children?: any }) {
	const p = getPulse();
	return (
		<RN.Animated.View
			style={{
				opacity: p.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 0.55, 1] }),
				transform: [{ scale: p.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 0.96, 1] }) }],
			}}
		>
			{children}
		</RN.Animated.View>
	);
}

const sendPulse: Feature = () => {
	if (typeof (FluxDispatcher as any)?.dispatch !== "function") {
		throw new Error("Couldn't find Discord's Flux dispatcher");
	}
	const target = findPatchTarget(TARGET);
	if (!target) throw new Error(`Couldn't find ${TARGET}`);
	const { parent, key, value } = target;

	const wrap = (_a: any[], ret: any) => ret == null || ret === false ? ret : React.createElement(Pulse, null, ret);
	const stops: (() => void)[] = [];
	if (typeof value === "function" && value.prototype?.isReactComponent) {
		stops.push(after("render", value.prototype, wrap));
	} else {
		stops.push(after(key, parent, wrap));
	}

	let me: string | undefined;
	try {
		me = (findByStoreName("UserStore") as any)?.getCurrentUser?.()?.id;
	} catch {}
	stops.push(before("dispatch", FluxDispatcher as any, (args: any[]) => {
		const e = args[0];
		if (e?.type !== "MESSAGE_CREATE") return;
		try {
			const mine = e.optimistic === true || (me && e.message?.author?.id === me);
			if (mine) play();
		} catch {}
	}));

	return { stop: () => stops.forEach(s => s()), detail: `Hooked ${TARGET} (${describe(value)})` };
};

export default sendPulse;
