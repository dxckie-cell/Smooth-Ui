import { ReactNative as RN } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import type { Feature } from "../features";
import { describe, findByFnName } from "../find";
import { animateNext } from "../layout";

const MARK = "__smoothUi";

function wrapPress(fn: any) {
	if (typeof fn !== "function" || fn[MARK]) return fn;
	const wrapped: any = function(this: any, ...args: any[]) {
		try {
			animateNext();
		} catch {}
		return fn.apply(this, args);
	};
	wrapped[MARK] = true;
	return wrapped;
}

/** Wraps `onPress` on a props / config object, in place when it isn't frozen. */
function withWrappedPress(obj: any): any {
	if (!obj || typeof obj.onPress !== "function" || obj.onPress[MARK]) return obj;
	const onPress = wrapPress(obj.onPress);
	if (Object.isFrozen(obj)) return { ...obj, onPress };
	obj.onPress = onPress;
	return obj;
}

type Host = { parent: any; key: string; kind: "props" | "this" };

/** Where a button component's render logic lives, whatever way it is wrapped. */
function hostFor(comp: any): Host | undefined {
	let c = comp;
	for (let i = 0; i < 4 && c; i++) {
		if (typeof c === "object") {
			// forwardRef
			if (typeof c.render === "function") return { parent: c, key: "render", kind: "props" };
			// memo(function component)
			if (typeof c.type === "function" && !c.type.prototype?.isReactComponent) {
				return { parent: c, key: "type", kind: "props" };
			}
			c = c.type;
			continue;
		}
		// class component: props are read lazily at press time
		if (typeof c === "function" && c.prototype?.isReactComponent && typeof c.prototype.render === "function") {
			return { parent: c.prototype, key: "render", kind: "this" };
		}
		break;
	}
}

/**
 * Wraps `onPress` so the layout change a tap causes (a panel opening, a list
 * swapping, ...) animates. Preferred route: React Native's shared `Pressability`
 * class, which every Pressable / Touchable is built on, so it doesn't matter
 * how each component is wrapped. Fallback: hook the components one by one.
 */
const taps: Feature = () => {
	const Pressability = findByFnName("Pressability");
	if (typeof Pressability?.prototype?.configure === "function") {
		const stop = before("configure", Pressability.prototype, (args: any[]) => {
			const config = withWrappedPress(args[0]);
			if (config !== args[0]) return [config, ...args.slice(1)];
		});
		return { stop, detail: "Hooked Pressability (all Pressable / Touchable buttons)" };
	}

	const stops: (() => void)[] = [];
	const names: string[] = [];
	const shapes: string[] = [];

	for (const name of ["Pressable", "TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback"]) {
		const comp = (RN as any)[name];
		shapes.push(`${name}: ${describe(comp)}`);
		const host = hostFor(comp);
		if (!host) continue;

		stops.push(before(host.key, host.parent, function(this: any, args: any[]) {
			if (host.kind === "this") {
				withWrappedPress(this?.props);
				return;
			}
			const props = withWrappedPress(args[0]);
			if (props !== args[0]) return [props, ...args.slice(1)];
		}));
		names.push(name);
	}

	if (!stops.length) {
		throw new Error(`Couldn't hook taps. Pressability: not found. ${shapes.join(". ")}`);
	}
	return {
		stop: () => stops.forEach(s => s()),
		detail: `Hooked ${names.join(", ")} (fallback)`,
	};
};

export default taps;
