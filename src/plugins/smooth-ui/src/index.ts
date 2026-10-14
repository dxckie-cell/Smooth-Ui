import Settings from "./components/Settings";
import { stopAll, sync } from "./features";
import { startMotion } from "./motion";
import { initConfig } from "./settings";

initConfig();
const stopLayout = startMotion();
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
