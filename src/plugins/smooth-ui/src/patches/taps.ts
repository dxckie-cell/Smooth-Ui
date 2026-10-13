import { ReactNative as RN } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import { animateNext } from "../layout";
import type { Feature } from "../features";

const wrappers = new WeakMap<Function, Function>();
const wrapped = new WeakSet<Function>();

function wrapPress(fn: Function) {
	if (wrapped.has(fn)) return fn;
	let w = wrappers.get(fn);
	if (!w) {
		w = function(this: any, ...args: any[]) {
			try {
				animateNext();
			} catch {}
			return fn.apply(this, args);
		};
		wrappers.set(fn, w);
		wrapped.add(w);
	}
	return w;
}

/** memo(forwardRef(fn)) / forwardRef(fn): returns the object that owns `render`. */
function renderHost(comp: any) {
	let c = comp;
	for (let i = 0; i < 4 && c && typeof c === "object"; i++) {
		if (typeof c.render === "function") return c;
		c = c.type;
	}
}

/**
 * Wraps `onPress` of Pressable / TouchableOpacity / TouchableHighlight so the
 * layout change a tap causes (a panel opening, a list swapping, ...) animates.
 */
const taps: Feature = () => {
	const stops: (() => void)[] = [];
	const names: string[] = [];

	for (const name of ["Pressable", "TouchableOpacity", "TouchableHighlight"]) {
		const host = renderHost((RN as any)[name]);
		if (!host) continue;
		stops.push(before("render", host, (args: any[]) => {
			const props = args[0];
			if (!props || typeof props.onPress !== "function" || wrapped.has(props.onPress)) return;
			const onPress = wrapPress(props.onPress);
			if (Object.isFrozen(props)) return [{ ...props, onPress }, ...args.slice(1)];
			props.onPress = onPress;
		}));
		names.push(name);
	}

	if (!stops.length) throw new Error("Couldn't find Pressable / Touchable components to hook");
	return {
		stop: () => stops.forEach(s => s()),
		detail: `Hooked ${names.join(", ")}`,
	};
};

export default taps;
