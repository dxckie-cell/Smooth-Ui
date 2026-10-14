import { find } from "@vendetta/metro";

export const nameOf = (v: any): string | undefined =>
	typeof v === "function" ? v.displayName ?? v.name : undefined;

/** Walks every module's exports until `pick` returns something. */
function scan<T>(pick: (value: any, key: string, mod: any) => T | undefined): T | undefined {
	let hit: T | undefined;
	find((m: any) => {
		if (hit !== undefined || !m || (typeof m !== "object" && typeof m !== "function")) return false;
		try {
			for (const k of Object.keys(m)) {
				const r = pick(m[k], k, m);
				if (r !== undefined) {
					hit = r;
					return true;
				}
			}
		} catch {}
		return false;
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

/** [exportsObject, key] holding `fn`, so it can be patched in place. */
export function findParentOf(fn: any): [any, string] | undefined {
	return scan((v, k, m) => (v === fn ? ([m, k] as [any, string]) : undefined));
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
