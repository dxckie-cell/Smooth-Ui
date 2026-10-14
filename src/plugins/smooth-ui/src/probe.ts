import { React } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import { diag } from "./diag";
import { initializedExports, nameOf } from "./find";

// chat / channel screens and lists; function components only, never data classes
const CANDIDATE = /^(Base)?(Chat|Channel|Messages?)\w*(Screen|View|List|Container|Content|Messages|Reader|Wrapper)$/;
// navigators, per-screen wrappers and transition pieces, to find what moves pages around
const NAVIGATION =
	/^(\w*Navigator|\w*StackView|CardStack|CardContainer|Card|SceneView|ScreenStack\w*|ScreenContainer|Screen|NativeScreen|NavigationContainer\w*|\w*Transition\w*|\w*Pager\w*|\w*Router)$/;

const counts = new Map<string, number>();
let stops: (() => void)[] = [];

export const probing = () => stops.length > 0;

/** Counts renders of chat / channel components (nothing is replaced). */
export function startProbe() {
	stopProbe();
	counts.clear();
	const bump = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);

	// count render requests by watching element creation: nothing gets replaced, so
	// components keep their identity (replacing them crashed Discord)
	const countType = (t: any) => {
		if (!t) return;
		const fn = typeof t === "function" ? t : typeof t === "object" ? (t.type ?? t.render) : undefined;
		const name = nameOf(fn) ?? nameOf(t?.render);
		if (name && name.length <= 40 && (CANDIDATE.test(name) || NAVIGATION.test(name))) bump(name);
	};
	const hook = (parent: any, key: string) => {
		try {
			if (typeof parent?.[key] === "function") {
				stops.push(before(key, parent, (args: any[]) => {
					try {
						countType(args[0]);
					} catch {}
				}));
			}
		} catch {}
	};
	hook(React, "createElement");
	for (const m of initializedExports()) {
		try {
			if (m && typeof m.jsx === "function" && typeof m.jsxs === "function" && "Fragment" in m) {
				hook(m, "jsx");
				hook(m, "jsxs");
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
