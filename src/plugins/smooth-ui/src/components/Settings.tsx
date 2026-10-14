import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { semanticColors } from "@vendetta/ui";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";

import { BetterTableRowGroup } from "$/components/BetterTableRow";
import Text from "$/components/Text";

import { envInfo } from "../diag";
import { type FeatureId, state, sync } from "../features";
import { animateNext } from "../layout";
import { type Config, config, resetConfig } from "../settings";

const { FormRow, FormSwitch } = Forms as any;

// a missing icon name falls back to the settings cog instead of an empty slot
const asset = (name: string) => getAssetIDByName(name) ?? getAssetIDByName("SettingsIcon");

const SPEEDS = [
	{ label: "Fast", ms: 140 },
	{ label: "Normal", ms: 200 },
	{ label: "Smooth", ms: 280 },
	{ label: "Slow", ms: 380 },
];
const STYLES: { value: Config["screenStyle"]; label: string }[] = [
	{ value: "slide-fade", label: "Slide + fade" },
	{ value: "fade", label: "Fade" },
];

const styles = stylesheet.createThemedStyleSheet({
	demo: {
		margin: 16,
		height: 56,
		borderRadius: 12,
		backgroundColor: semanticColors.BACKGROUND_MOD_STRONG,
		alignItems: "center",
		justifyContent: "center",
	},
	destructiveIcon: {
		tintColor: semanticColors.TEXT_FEEDBACK_CRITICAL,
	},
});

function SwitchRow(
	{ label, sub, icon, value, onChange }: {
		label: string;
		sub: string;
		icon: string;
		value: boolean;
		onChange: (v: boolean) => void;
	},
) {
	return (
		<FormRow
			label={label}
			subLabel={sub}
			leading={<FormRow.Icon source={asset(icon)} />}
			trailing={<FormSwitch value={value} onValueChange={onChange} />}
			onPress={() => onChange(!value)}
		/>
	);
}

function statusText(id: FeatureId) {
	const s = state[id];
	if (s.error) return `Not working: ${s.error}`;
	if (s.on) return s.detail ? `Active. ${s.detail}` : "Active";
	return "Off";
}

/** Tap to see the current speed / movement settings on a box that appears and disappears. */
function Preview() {
	const [shown, setShown] = React.useState(false);
	return (
		<>
			<FormRow
				label="Preview"
				subLabel="Tap to show or hide a box with the current settings"
				leading={<FormRow.Icon source={asset("PlayIcon")} />}
				onPress={() => {
					animateNext(true);
					setShown(v => !v);
				}}
			/>
			{shown && (
				<RN.View style={styles.demo}>
					<Text variant="text-md/semibold" color="TEXT_DEFAULT">Smooth</Text>
				</RN.View>
			)}
		</>
	);
}

export default () => {
	useProxy(config);
	const [, refresh] = React.useReducer((x: number) => x + 1, 0);

	const set = <K extends keyof Config>(key: K, value: Config[K]) => {
		config[key] = value;
		sync();
		refresh();
	};

	const speedIdx = SPEEDS.reduce(
		(best, s, i) => Math.abs(s.ms - config.speed) < Math.abs(SPEEDS[best].ms - config.speed) ? i : best,
		0,
	);
	const styleLabel = STYLES.find(s => s.value === config.screenStyle)?.label ?? STYLES[0].label;

	return (
		<RN.ScrollView>
			<BetterTableRowGroup title="Animations" icon={asset("SettingsIcon")}>
				<SwitchRow
					label="Tap animations"
					sub="Content that appears or disappears after a tap fades in and out"
					icon="HandRequestSpeakIcon"
					value={config.taps}
					onChange={v => set("taps", v)}
				/>
				<SwitchRow
					label="Channel switch fade"
					sub="Cross-fade the chat when you open another channel"
					icon="ChatIcon"
					value={config.channels}
					onChange={v => set("channels", v)}
				/>
				<SwitchRow
					label="Move animations"
					sub="Also animate things sliding and resizing, not just fading. Can look odd in message lists"
					icon="ArrowsUpDownIcon"
					value={config.moves}
					onChange={v => set("moves", v)}
				/>
				<FormRow
					label="Speed"
					subLabel={`${SPEEDS[speedIdx].label} (${SPEEDS[speedIdx].ms} ms). Tap to change`}
					leading={<FormRow.Icon source={asset("ClockIcon")} />}
					trailing={<FormRow.Arrow />}
					onPress={() => set("speed", SPEEDS[(speedIdx + 1) % SPEEDS.length].ms)}
				/>
				<Preview />
			</BetterTableRowGroup>

			<BetterTableRowGroup title="Experimental" icon={asset("SettingsIcon")}>
				<SwitchRow
					label="Screen transitions"
					sub="Replace the animation when opening and closing screens"
					icon="ArrowAngleRightUpIcon"
					value={config.screens}
					onChange={v => set("screens", v)}
				/>
				<FormRow
					label="Transition style"
					subLabel={`${styleLabel}. Tap to change. Native stacks only support Fade`}
					leading={<FormRow.Icon source={asset("PaintPaletteIcon")} />}
					trailing={<FormRow.Arrow />}
					onPress={() => {
						const i = STYLES.findIndex(s => s.value === config.screenStyle);
						set("screenStyle", STYLES[(i + 1) % STYLES.length].value);
					}}
				/>
			</BetterTableRowGroup>

			<BetterTableRowGroup title="Accessibility" icon={asset("SettingsIcon")}>
				<SwitchRow
					label="Respect reduce motion"
					sub="Turn animations off when your phone's reduce motion setting is on"
					icon="EyeIcon"
					value={config.respectReduceMotion}
					onChange={v => set("respectReduceMotion", v)}
				/>
			</BetterTableRowGroup>

			<BetterTableRowGroup title="Status" icon={asset("InfoIcon")}>
				<FormRow label="Tap animations" subLabel={statusText("taps")} />
				<FormRow label="Channel switch fade" subLabel={statusText("channels")} />
				<FormRow label="Screen transitions" subLabel={statusText("screens")} />
				<FormRow label="Diagnostics" subLabel={envInfo()} />
				<FormRow
					label={
						<Text variant="text-md/semibold" color="TEXT_FEEDBACK_CRITICAL">
							Reset to defaults
						</Text>
					}
					leading={
						<FormRow.Icon
							style={styles.destructiveIcon}
							source={asset("TrashIcon")}
						/>
					}
					onPress={() => {
						resetConfig();
						sync();
						refresh();
					}}
				/>
			</BetterTableRowGroup>
			<RN.View style={{ height: 24 }} />
		</RN.ScrollView>
	);
};
