import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

import type { Feature } from "../features";
import { animateNext } from "../layout";

// switching to a channel, and its messages arriving
const EVENTS = new Set(["CHANNEL_SELECT", "LOAD_MESSAGES_SUCCESS"]);

/** Cross-fades the chat when you switch channels. */
const channels: Feature = () => {
	if (typeof (FluxDispatcher as any)?.dispatch !== "function") {
		throw new Error("Couldn't find Discord's Flux dispatcher");
	}

	const stop = before("dispatch", FluxDispatcher as any, (args: any[]) => {
		const type = args[0]?.type;
		if (typeof type === "string" && EVENTS.has(type)) animateNext();
	});

	return { stop, detail: `Listening for ${[...EVENTS].join(", ")}` };
};

export default channels;
