import { find, findByProps } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";

import { describe, nameOf } from "./find";

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

/**
 * Walks every module once (slow, so only on demand) and reports the navigation
 * pieces Discord has plus the names of its chat / channel components.
 */
export function scanInternals(): string {
	const found = new Map<string, string>();
	const candidates = new Set<string>();

	find((m: any) => {
		if (!m || (typeof m !== "object" && typeof m !== "function")) return false;
		try {
			for (const k of Object.keys(m)) {
				const v = m[k];
				if (!v) continue;
				const name = nameOf(v) ?? nameOf(v.type) ?? nameOf(v.render);
				if (!name) continue;
				if (WANTED.includes(name) && !found.has(name)) found.set(name, describe(v));
				else if (
					/^(Chat|Channel|Message|Text)/.test(name)
					&& /(Screen|Chat|List|View|Container|Page)$/.test(name)
				) candidates.add(name);
			}
		} catch {}
		return false;
	});

	const lines = WANTED.map(n => `${n}: ${found.get(n) ?? "not found"}`);
	lines.push(`Chat-like components (${candidates.size}): ${[...candidates].slice(0, 40).join(", ") || "none"}`);
	return lines.join("\n");
}
