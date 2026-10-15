import { nameOf } from "./find";
import { diag } from "./diag";
import { hookRowType, idsOf } from "./patches/messages";

const MAX_NODES = 6000;

const unwrap = (t: any): any => (typeof t === "function" ? t : t?.type ?? t?.render);

function startFiber(r: any): any {
	if (!r) return undefined;
	return r.__internalInstanceHandle ?? r._internalInstanceHandle ?? r.canonical?.internalInstanceHandle
		?? r._internalFiberInstanceHandleDEV;
}

/** Reads (never changes) the React tree under the chat view and hooks the message row components it finds. */
export function inspectChat(ref: any): string {
	const out = inspect(ref);
	// keep an earlier good result when the chat has since been closed
	if (!out.startsWith("The chat isn't") || !diag.inspectText) diag.inspectText = out;
	return diag.inspectText;
}

function scanTree(rootFiber: any) {
	const counts = new Map<string, number>();
	const rowTypes = new Map<any, string>();
	const rowParents = new Set<string>();
	const deepRows = new Set<string>();
	const listLines: string[] = [];
	const label = (node: any) => {
		const fn = unwrap(node.type);
		if (typeof fn === "function") return nameOf(fn) || "(anon)";
		return typeof node.type === "string" ? `<${node.type}>` : "(other)";
	};
	const keys = (p: any) => (p && typeof p === "object" ? Object.keys(p).slice(0, 6).join(",") : "");
	// a message-shaped object anywhere in the first three levels of a node's props
	const deepMsg = (v: any, d = 0): boolean => {
		if (!v || typeof v !== "object" || d > 2) return false;
		if (typeof v.id === "string" && (v.channel_id || v.channelId) && (v.content !== undefined || v.author || v.timestamp)) return true;
		try {
			for (const k of Object.keys(v).slice(0, 12)) if (deepMsg(v[k], d + 1)) return true;
		} catch {}
		return false;
	};

	// depth-first so the printed outline reads like the tree
	let n = 0;
	const walk = (node: any, depth: number, path: string[], inList: boolean) => {
		for (; node && n < MAX_NODES; node = node.sibling) {
			n++;
			const fn = unwrap(node.type);
			const name = label(node);
			if (typeof fn === "function") counts.set(name, (counts.get(name) ?? 0) + 1);
			const listHere = inList || name === "DCDChatList";
			try {
				if (typeof fn === "function" && idsOf(node.memoizedProps).length && !rowTypes.has(fn)) {
					rowTypes.set(fn, name);
					rowParents.add(`${path.slice(-3).join(" > ")} > ${name}`);
				} else if (typeof fn === "function" && deepMsg(node.memoizedProps) && deepRows.size < 6) {
					deepRows.add(`${path.slice(-3).join(" > ")} > ${name}(${keys(node.memoizedProps)})`);
				}
			} catch {}
			if (listHere && typeof fn === "function" && listLines.length < 45) {
				listLines.push(`${"  ".repeat(Math.min(depth, 10))}${name} {${keys(node.memoizedProps)}}`);
			}
			if (node.child) walk(node.child, depth + 1, typeof fn === "function" ? [...path, name] : path, listHere);
		}
	};

	walk(rootFiber.child, 0, [], false);
	return { n, counts, rowTypes, rowParents, deepRows, listLines };
}

function inspect(chatRef: any): string {
	diag.inspectRuns++;
	diag.refState = !chatRef ? "empty" : startFiber(chatRef) ? "ok" : `no fiber (keys: ${Object.keys(chatRef).slice(0, 10).join(",")})`;
	const root = startFiber(chatRef);
	if (!root) {
		return chatRef
			? `Found the chat view but not its React fiber (keys: ${Object.keys(chatRef).slice(0, 12).join(",")})`
			: "The chat isn't on screen right now. Open a channel; the plugin looks for message rows by itself a few seconds after a chat opens";
	}

	// the handle can point at the previous ("alternate") copy of a fiber, which still shows the
	// tree from before messages loaded; scan both copies and keep the bigger tree
	const candidates = [root, root.alternate].filter(Boolean);
	let best: ReturnType<typeof scanTree> | undefined;
	const sizes: number[] = [];
	for (const c of candidates) {
		const r = scanTree(c);
		sizes.push(r.n);
		if (!best || r.n > best.n) best = r;
	}
	const { n, counts, rowTypes, rowParents, deepRows, listLines } = best!;
	const hooks = [...rowTypes].map(([fn, name]) => hookRowType(fn, name));
	const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k} x${v}`);
	return [
		`Read ${n} nodes under the chat (fiber copies: ${sizes.join(" / ")}).`,
		`Message rows (${rowTypes.size}): ${hooks.join(", ") || "none found"}`,
		...[...rowParents].slice(0, 6).map(p => `Path: ${p}`),
		...[...deepRows].map(p => `Nested message in props: ${p}`),
		`Components: ${top.join(", ")}`,
		`Inside DCDChatList:`,
		...(listLines.length ? listLines : ["(not found)"]),
	].join("\n");
}
