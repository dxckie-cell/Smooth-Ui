import Settings from "./components/Settings";
import { stopAll, sync } from "./features";
import { startLayout } from "./layout";
import { initConfig } from "./settings";

initConfig();
const stopLayout = startLayout();
sync();

export function onLoad() {
	initConfig();
	sync();
}

export function onUnload() {
	stopAll();
	stopLayout();
}

export const settings = Settings;
