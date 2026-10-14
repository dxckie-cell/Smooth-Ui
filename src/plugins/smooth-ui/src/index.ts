import Settings from "./components/Settings";
import { stopCapturing } from "./diag";
import { stopAll, sync } from "./features";
import { startMotion } from "./motion";
import { stopProbe } from "./probe";
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
	stopCapturing();
	stopProbe();
	stopLayout();
}

export const settings = Settings;
