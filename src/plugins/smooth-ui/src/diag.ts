import { findByProps } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";

import { describe, initializedExports, nameOf } from "./find";

/** Counters filled in by layout.ts so the settings page can show what happened. */
export const diag = { calls: 0, lastError: undefined as string | undefined };

function safe(fn: () => any): string {
	try {
		const v = fn();
		return v === undefined ? "undefined" : String(v);
	} catch (e: any) {
		return `error: ${e?.message ?? e}`;
	}
}

/** Facts about this Discord build that decide which animation APIs can work. */
export function envInfo(): string {
	const g = globalThis as any;
	const lines = [
		`Platform: ${safe(() => `${RN.Platform?.OS} ${RN.Platform?.Version}`)}`,
		`React Native: ${
			safe(() => {
				const v = RN.Platform?.constants?.reactNativeVersion;
				return v ? `${v.major}.${v.minor}.${v.patch}` : undefined;
			})
		}`,
		`Fabric: ${!!g.nativeFabricUIManager}, bridgeless: ${!!g.RN$Bridgeless}, hermes: ${!!g.HermesInternal}`,
		`UIManager: ${safe(() => typeof RN.UIManager)}`,
		`LayoutAnimation.configureNext: ${safe(() => typeof RN.LayoutAnimation?.configureNext)}`,
		`configureNext calls: ${diag.calls}, last error: ${diag.lastError ?? "none"}`,
		`Reanimated: ${safe(() => (findByProps("useSharedValue") ? "found" : "not found"))}`,
		`Reanimated FadeIn: ${safe(() => (findByProps("FadeIn") ? "found" : "not found"))}`,
	];
	return lines.join("\n");
}

const WANTED = ["CardStack", "StackView", "NativeStackView", "Pressability"];
const NAV = /(Stack|Navigator|Transition|Animat|Fade|Screen)/;
const CHAT = /^(Chat|Channel|Message|Guild|Sidebar|Tab|Drawer)/;

const fnNames = (v: any): string[] => {
	const names = [nameOf(v), nameOf(v?.type), nameOf(v?.render)].filter(Boolean) as string[];
	return names;
};

/** Reads the already-loaded modules (no search cache) and lists navigation / chat components. */
export function scanInternals(): string {
	const found = new Map<string, string>();
	const nav = new Set<string>();
	const chat = new Set<string>();
	const mods = initializedExports();

	for (const m of mods) {
		try {
			for (const k of Object.keys(m)) {
				const v = m[k];
				if (!v || (typeof v !== "function" && typeof v !== "object")) continue;
				for (const name of fnNames(v)) {
					if (WANTED.includes(name) && !found.has(name)) found.set(name, describe(v));
					else if (NAV.test(name) && name.length < 40) nav.add(name);
					else if (CHAT.test(name) && name.length < 40) chat.add(name);
				}
				if (typeof v === "function" && /^create\w*(Stack|Navigator)\w*$/.test(k)) nav.add(`${k}()`);
			}
		} catch {}
	}

	const list = (set: Set<string>) => [...set].sort().slice(0, 60).join(", ") || "none";
	return [
		`Modules read: ${mods.length}`,
		...WANTED.map(n => `${n}: ${found.get(n) ?? "not found"}`),
		`Navigation-like (${nav.size}): ${list(nav)}`,
		`Chat-like (${chat.size}): ${list(chat)}`,
	].join("\n");
}

/** Copies text with Discord's own clipboard module; returns whether it worked. */
export function copyText(text: string): boolean {
	try {
		const c: any = findByProps("setString");
		if (typeof c?.setString !== "function") return false;
		c.setString(text);
		return true;
	} catch {
		return false;
	}
}
