import { findByProps } from "@vendetta/metro";
import { FluxDispatcher, ReactNative as RN } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import { describe, initializedExports, nameOf } from "./find";

/** Counters filled in by the patches so the settings page can show what happened. */
export const diag = {
	jsCalls: 0,
	jsChanged: 0,
	nativeCalls: 0,
	nativeChanged: 0,
	fades: 0,
	fadeRenders: 0,
	/** what the faded component returns: its type and whether it has a style */
	fadeRoot: "not rendered yet",
	sendPulses: 0,
	/** route name -> "presentation/animation" Discord gave it, for native stack screens seen */
	routes: new Map<string, string>(),
	/** Flux event type -> count, most recent last (only filled while capturing) */
	events: new Map<string, number>(),
};

let stopCapture: (() => void) | undefined;
export const capturing = () => !!stopCapture;

/** Starts or stops recording the types of Flux events Discord dispatches. */
export function toggleCapture() {
	if (stopCapture) {
		stopCapture();
		stopCapture = undefined;
		return;
	}
	diag.events.clear();
	stopCapture = before("dispatch", FluxDispatcher as any, (args: any[]) => {
		const type = args[0]?.type;
		if (typeof type !== "string") return;
		const n = diag.events.get(type) ?? 0;
		diag.events.delete(type); // re-insert so the newest event is last
		diag.events.set(type, n + 1);
	});
}

export function stopCapturing() {
	try {
		stopCapture?.();
	} catch {}
	stopCapture = undefined;
}

export function eventsText(): string {
	const list = [...diag.events.entries()].slice(-40).map(([t, n]) => `${t}${n > 1 ? ` x${n}` : ""}`);
	return list.length ? `${diag.events.size} event types, newest last:\n${list.join("\n")}` : "No events recorded";
}

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
		`Screen hooks: JS stack called ${diag.jsCalls}x (changed ${diag.jsChanged} screens), native stack called ${diag.nativeCalls}x (changed ${diag.nativeChanged})`,
		`Chat fades played: ${diag.fades}, faded ${diag.fadeRenders}x`,
		`Fade target: ${diag.fadeRoot}`,
		`Send animations played: ${diag.sendPulses}`,
		`Native routes seen (${diag.routes.size}): ${
			[...diag.routes.entries()].slice(-20).map(([n, v]) => `${n} [${v}]`).join(", ") || "none"
		}`,
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
	const msgs = new Set<string>();
	const mods = initializedExports();

	for (const m of mods) {
		try {
			for (const k of Object.keys(m)) {
				const v = m[k];
				if (!v || (typeof v !== "function" && typeof v !== "object")) continue;
				for (const name of fnNames(v)) {
					if (/Message/.test(name) && name.length < 50) msgs.add(name);
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
		`Message-like (${msgs.size}): ${[...msgs].sort().join(", ") || "none"}`,
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
