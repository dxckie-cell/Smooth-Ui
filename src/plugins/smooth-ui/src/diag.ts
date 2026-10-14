import { findByProps } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";

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
