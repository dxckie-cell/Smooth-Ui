import { before } from "@vendetta/patcher";

import { diag } from "./diag";
import { findPatchTarget, initializedExports, nameOf } from "./find";
import { recordRoutes } from "./patches/screens";

// chat / channel screens and lists; function components only, never data classes
const CANDIDATE = /^(Base)?(Chat|Channel|Messages?)\w*(Screen|View|List|Container|Content|Messages|Reader|Wrapper)$/;
// navigators, per-screen wrappers and transition pieces, to find what moves pages around
const NAVIGATION =
	/^(\w*Navigator|\w*StackView|CardStack|CardContainer|Card|SceneView|ScreenStack\w*|ScreenContainer|Screen|NativeScreen|NavigationContainer\w*|\w*Transition\w*|\w*Pager\w*|\w*Router)$/;
const MAX = 200;

const counts = new Map<string, number>();
let stops: (() => void)[] = [];

export const probing = () => stops.length > 0;

function looksLikeComponent(fn: any) {
	if (typeof fn !== "function" || fn.length > 2) return false;
	if (fn.prototype?.isReactComponent) return true;
	// plain classes / constructors have methods on their prototype; function components don't
	return Object.getOwnPropertyNames(fn.prototype ?? {}).every(k => k === "constructor");
}

/** Counts renders of chat / channel components and records native stack routes (nothing is changed). */
export function startProbe() {
	stopProbe();
	counts.clear();
	const seen = new Set<any>();
	const bump = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);

	const consider = (parent: any, key: string, fn: any) => {
		if (stops.length >= MAX || seen.has(fn) || !looksLikeComponent(fn)) return;
		const name = nameOf(fn);
		if (!name || name.length > 40 || !(CANDIDATE.test(name) || NAVIGATION.test(name))) return;
		seen.add(fn);
		try {
			if (fn.prototype?.isReactComponent) stops.push(before("render", fn.prototype, () => void bump(name)));
			else stops.push(before(key, parent, () => void bump(name)));
		} catch {}
	};

	// first: once the generic pass wraps it, the original name can't be found any more
	try {
		const nav = findPatchTarget("NativeStackView");
		if (nav && typeof nav.value === "function" && !nav.value.prototype?.isReactComponent) {
			stops.push(before(nav.key, nav.parent, (args: any[]) => {
				try {
					recordRoutes(args[0]?.descriptors);
				} catch {}
			}));
		}
	} catch {}
	for (const m of initializedExports()) {
		try {
			for (const k of Object.keys(m)) {
				const v = m[k];
				if (!v) continue;
				if (typeof v === "function") consider(m, k, v);
				else if (typeof v === "object") {
					if (typeof v.type === "function") consider(v, "type", v.type);
					if (typeof v.render === "function") consider(v, "render", v.render);
				}
			}
		} catch {}
	}

	return stops.length;
}

export function stopProbe() {
	for (const s of stops) {
		try {
			s();
		} catch {}
	}
	stops = [];
}

export function probeText(): string {
	const rendered = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
	const routes = [...diag.routes.entries()].map(([n, v]) => `${n} [${v}]`).join(", ") || "none";
	return [
		`Components that rendered (${rendered.length}):`,
		...(rendered.length ? rendered.map(([n, c]) => `${n} x${c}`) : ["none"]),
		`Native routes seen (${diag.routes.size}): ${routes}`,
	].join("\n");
}
