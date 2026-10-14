import { FluxDispatcher, React, ReactNative as RN } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

import { diag } from "../diag";
import type { Feature } from "../features";
import { describe, findPatchTarget } from "../find";
import { motionAllowed } from "../motion";
import { clampSpeed, config } from "../settings";

// MessagesItemChannelContent turned out to be the channel *list* row. These are guesses at the
// real message row; a component only animates when its props carry a message id, so a wrong
// guess is harmless.
const TARGETS = ["ChatViewMessage", "ChatMessage", "MessageItem", "MessageRow", "MessageContainer", "Message"];

/** ids / nonces of messages that just arrived and haven't animated yet */
const fresh = new Set<string>();
const remember = (id: unknown) => {
	if (typeof id !== "string") return;
	fresh.add(id);
	if (fresh.size > 60) fresh.delete(fresh.values().next().value as string);
};

/** The message id behind a list row, wherever this Discord build keeps it. */
function idsOf(props: any): string[] {
	const m = props?.message ?? props?.item?.message ?? props?.messageRecord;
	return [m?.id, m?.nonce, props?.messageId, props?.id, props?.item?.id]
		.filter((x): x is string => typeof x === "string");
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
	const wrap = function(args: any[], ret: any) {
		if (ret == null || ret === false) return ret;
		const ids = idsOf(args[0]);
		if (!ids.length) return ret;
		diag.messageSample = Object.keys(args[0] ?? {}).slice(0, 12).join(",");
		return React.createElement(Pop, { ids }, ret);
	};
	for (const name of TARGETS) {
		const target = findPatchTarget(name);
		if (!target) continue;
		const { parent, key, value } = target;
		hooked.push(describe(value));
		if (typeof value === "function" && value.prototype?.isReactComponent) {
			stops.push(after("render", value.prototype, function(this: any, _a: any[], r: any) {
				return wrap([this.props], r);
			}));
		} else {
			stops.push(after(key, parent, wrap));
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
