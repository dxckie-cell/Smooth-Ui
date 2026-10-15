import { find } from "@vendetta/metro";

export const nameOf = (v: any): string | undefined =>
	typeof v === "function" ? v.displayName ?? v.name : undefined;

/** Exports of every module that is already initialized (no side effects, no search cache). */
export function initializedExports(): any[] {
	const out: any[] = [];
	const mods = (globalThis as any).modules;
	if (!mods) return out;
	for (const id in mods) {
		try {
			const m = mods[id];
			if (!m?.isInitialized || m.hasError) continue;
			const e = m.publicModule?.exports;
			if (e && (typeof e === "object" || typeof e === "function")) out.push(e);
		} catch {}
	}
	return out;
}

function scanExports<T>(
	m: any,
	pick: (value: any, key: string, mod: any) => T | undefined,
): T | undefined {
	for (const k of Object.keys(m)) {
		const r = pick(m[k], k, m);
		if (r !== undefined) return r;
	}
}

/**
 * Walks module exports until `pick` returns something. Revenge's `find` caches
 * results per filter and all my anonymous filters share one cache key, so a
 * miss can poison later lookups; the direct pass over initialized modules comes
 * first and doesn't have that problem.
 */
function scan<T>(pick: (value: any, key: string, mod: any) => T | undefined): T | undefined {
	for (const m of initializedExports()) {
		try {
			const r = scanExports(m, pick);
			if (r !== undefined) return r;
		} catch {}
	}

	let hit: T | undefined;
	find((m: any) => {
		if (hit !== undefined || !m || (typeof m !== "object" && typeof m !== "function")) return false;
		try {
			hit = scanExports(m, pick);
		} catch {}
		return hit !== undefined;
	});
	return hit;
}

/** Finds a function / class by name among every module's exports (plain, memo or forwardRef). */
export function findByFnName(wanted: string): any {
	return scan(v => {
		if (nameOf(v) === wanted) return v;
		if (v && typeof v === "object" && nameOf(v.type) === wanted) return v.type;
	});
}

/** Where a named component lives, so it can be patched in place (plain, class, memo or forwardRef). */
export function findPatchTarget(
	wanted: string,
): { parent: any; key: string; value: any } | undefined {
	return scan(
		(v, k, m) => {
			if (nameOf(v) === wanted) return { parent: m, key: k, value: v };
			if (v && typeof v === "object") {
				if (nameOf(v.type) === wanted) return { parent: v, key: "type", value: v.type };
				if (nameOf(v.render) === wanted) return { parent: v, key: "render", value: v.render };
			}
		},
	);
}

/** [exportsObject, key] holding `fn`, so it can be patched in place. */
export function findParentOf(fn: any): [any, string] | undefined {
	return scan((v, k, m) => {
		if (v === fn) return [m, k] as [any, string];
		if (v && typeof v === "object") {
			if (v.type === fn) return [v, "type"] as [any, string];
			if (v.render === fn) return [v, "render"] as [any, string];
		}
	});
}

/** Short description of a value's shape, for the status page. */
export function describe(v: any): string {
	if (v === undefined || v === null) return String(v);
	if (typeof v === "function") {
		return `${v.prototype?.isReactComponent ? "class" : "function"} ${nameOf(v) || "anonymous"}`;
	}
	if (typeof v === "object") {
		const keys = Object.keys(v).slice(0, 5).join(",");
		return `object{${keys}${v.type ? `; type=${describe(v.type)}` : ""}}`;
	}
	return typeof v;
}
