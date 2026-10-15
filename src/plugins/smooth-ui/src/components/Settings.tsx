import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { semanticColors } from "@vendetta/ui";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";

import { BetterTableRowGroup } from "$/components/BetterTableRow";
import Text from "$/components/Text";

import { type FeatureId, state, sync } from "../features";
import { type Config, config, resetConfig } from "../settings";

const { FormRow, FormSwitch } = Forms as any;

// a missing icon name falls back to the settings cog instead of an empty slot
const asset = (name: string) => getAssetIDByName(name) ?? getAssetIDByName("SettingsIcon");

const SPEEDS = [
	{ label: "Fast", ms: 140 },
	{ label: "Normal", ms: 200 },
	{ label: "Smooth", ms: 280 },
	{ label: "Slow", ms: 380 },
	{ label: "Test (very slow)", ms: 1000 },
	{ label: "Extra slow", ms: 2000 },
];

const styles = stylesheet.createThemedStyleSheet({
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

	return (
		<RN.ScrollView>
			<BetterTableRowGroup title="Animations" icon={asset("SettingsIcon")}>
				<SwitchRow
					label="Channel fade"
					sub="Fade the chat in when you open another channel"
					icon="ChatIcon"
					value={config.chatFade}
					onChange={v => set("chatFade", v)}
				/>
				<SwitchRow
					label="Send animation"
					sub="The message bar squeezes and flashes when you send a message"
					icon="ChatIcon"
					value={config.sendPulse}
					onChange={v => set("sendPulse", v)}
				/>
				<FormRow
					label="Speed"
					subLabel={`${SPEEDS[speedIdx].label} (${SPEEDS[speedIdx].ms} ms). Tap to change`}
					leading={<FormRow.Icon source={asset("ClockIcon")} />}
					trailing={<FormRow.Arrow />}
					onPress={() => set("speed", SPEEDS[(speedIdx + 1) % SPEEDS.length].ms)}
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
				<FormRow label="Channel fade" subLabel={statusText("chatFade")} />
				<FormRow label="Send animation" subLabel={statusText("sendPulse")} />
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
