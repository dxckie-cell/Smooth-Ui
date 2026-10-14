import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// Candidates for the real chat message row, taken from the scan of this Discord build.
// A component only animates when its props carry a message id, so wrong guesses are harmless.
const TARGETS = ["MessageRow", "MessageRowWrapper", "MessageRowContent", "ChatMessage", "MessageItem"];

/** ids / nonces of messages that just arrived and haven't animated yet */
const fresh = new Set<string>();
const remember = (id: unknown) => {
	if (typeof id !== "string") return;
	fresh.add(id);
	if (fresh.size > 60) fresh.delete(fresh.values().next().value as string);
};

/** The message id behind a list row: looks for a message-shaped object in the props (two levels). */
function idsOf(props: any): string[] {
	const out: string[] = [];
	const take = (m: any) => {
		if (m && typeof m === "object" && typeof m.id === "string" && (m.channel_id || m.channelId || m.author)) {
			out.push(m.id);
			if (typeof m.nonce === "string") out.push(m.nonce);
			return true;
		}
		return false;
	};
	if (!props || typeof props !== "object") return out;
	for (const k of Object.keys(props)) {
		const v = props[k];
		if (take(v) || !v || typeof v !== "object") continue;
		for (const k2 of ["message", "messageRecord", "rowData"]) take(v[k2]);
	}
	return out;
}

function Pop({ children, ids }: { children?: any; ids: string[] }) {
	// decided once, on mount, so rows recycled by scrolling never animate
	const [go] = React.useState(() => {
		const hit = ids.find(i => fresh.has(i));
		if (!hit) return false;
		ids.forEach(i => fresh.delete(i));
		return motionAllowed();
	});
	const v = React.useRef(new RN.Animated.Value(go ? 0 : 1)).current;
	React.useEffect(() => {
		if (!go) return;
		diag.messagePops++;
		RN.Animated.timing(v, {
			toValue: 1,
			duration: Math.min(clampSpeed(config.speed), 600),
			easing: RN.Easing.out(RN.Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, []);
	if (!go) return children;
	return (
		<RN.Animated.View
			style={{
				opacity: v,
				transform: [
					{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
					{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
				],
			}}
		>
			{children}
		</RN.Animated.View>
	);
}

/** New messages (yours and other people's) ease in, Messenger-style, instead of popping in. */
const messagePop: Feature = () => {
	if (typeof (FluxDispatcher as any)?.dispatch !== "function") {
		throw new Error("Couldn't find Discord's Flux dispatcher");
	}
	const stops: (() => void)[] = [];
	const hooked: string[] = [];
	const sampled = new Set<string>();
	const mk = (name: string) => (args: any[], ret: any) => {
		if (ret == null || ret === false) return ret;
		const ids = idsOf(args[0]);
		if (!sampled.has(name)) {
			sampled.add(name);
			diag.messageSample += `${name}(${ids.length ? "msg" : "no msg"}: ${Object.keys(args[0] ?? {}).slice(0, 8).join(",")}) `;
		}
		if (!ids.length) return ret;
		return React.createElement(Pop, { ids }, ret);
	};
	for (const name of TARGETS) {
		const target = findPatchTarget(name);
		if (!target) continue;
		const { parent, key, value } = target;
		hooked.push(describe(value));
		if (typeof value === "function" && value.prototype?.isReactComponent) {
			stops.push(after("render", value.prototype, function(this: any, _a: any[], r: any) {
				return mk(name)([this.props], r);
			}));
		} else {
			stops.push(after(key, parent, mk(name)));
		}
	}
	if (!hooked.length) throw new Error(`Couldn't find any of: ${TARGETS.join(", ")}`);
	stops.push(before("dispatch", FluxDispatcher as any, (args: any[]) => {
		const e = args[0];
		if (e?.type !== "MESSAGE_CREATE") return;
		remember(e.message?.id);
		remember(e.message?.nonce);
	}));

	return {
		stop: () => {
			stops.forEach(s => s());
			fresh.clear();
		},
		detail: `Hooked ${hooked.join(", ")}`,
	};
};

export default messagePop;
