import { nameOf } from "./find";
import { chatRef } from "./patches/chatfade";
import { hookRowType, idsOf } from "./patches/messages";

const MAX_NODES = 6000;

const unwrap = (t: any): any => (typeof t === "function" ? t : t?.type ?? t?.render);

function startFiber(): any {
	const r: any = chatRef;
	if (!r) return undefined;
	return r.__internalInstanceHandle ?? r._internalInstanceHandle ?? r.canonical?.internalInstanceHandle
		?? r._internalFiberInstanceHandleDEV;
}

/** Reads (never changes) the React tree under the chat view and hooks the message row components it finds. */
export function inspectChat(): string {
	const root = startFiber();
	if (!root) {
		return chatRef
			? `Found the chat view but not its React fiber (keys: ${Object.keys(chatRef).slice(0, 12).join(",")})`
			: "The chat isn't on screen. Turn on Channel fade, open a channel, then come back here and tap again";
	}

	const counts = new Map<string, number>();
	const rowTypes = new Map<any, string>();
	const rowParents = new Set<string>();
	const stack: [any, number, string[]][] = [[root.child, 0, []]];
	let n = 0;
	while (stack.length && n < MAX_NODES) {
		const [node0, depth, path] = stack.pop()!;
		for (let node = node0; node && n < MAX_NODES; node = node.sibling) {
			n++;
			const fn = unwrap(node.type);
			const name = typeof fn === "function" ? nameOf(fn) : undefined;
			if (name) {
				counts.set(name, (counts.get(name) ?? 0) + 1);
				try {
					if (idsOf(node.memoizedProps).length && !rowTypes.has(fn)) {
						rowTypes.set(fn, name);
						rowParents.add(`${path.slice(-3).join(" > ")} > ${name}`);
					}
				} catch {}
			}
			if (node.child) stack.push([node.child, depth + 1, name ? [...path, name] : path]);
		}
	}

	const hooks = [...rowTypes].map(([fn, name]) => hookRowType(fn, name));
	const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k} x${v}`);
	return [
		`Read ${n} nodes under the chat.`,
		`Message rows (${rowTypes.size}): ${hooks.join(", ") || "none found"}`,
		...[...rowParents].slice(0, 6).map(p => `Path: ${p}`),
		`Components: ${top.join(", ")}`,
	].join("\n");
}
