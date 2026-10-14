# Smooth UI

A [Revenge](https://github.com/revenge-mod) plugin for Discord mobile that makes the interface feel smoother: things that appear or disappear **cross-fade** instead of popping, like the Server pins / Local pins switch in Local Pins.

## Features

- **Channel fade:** fades Discord's chat in when you switch channels, using React Native's `Animated` (the same thing the Local Pins chips use). Off by default while it's being tested.
- **Speed:** Fast, Normal, Smooth, Slow, or a very slow Test speed. The **Preview** row fades a box with the current speed.
- **Screen transitions (experimental, off by default):** replaces the animation when opening and closing pages with a fade or slide + fade. It depends on Discord's navigation internals, so check the **Status** section for whether it hooked in and how many screens it changed. On native stacks only Fade works.
- **Respect reduce motion:** animations are skipped when your phone's reduce motion setting is on.

The **Status** section shows whether each feature is active (or why it couldn't start), diagnostics about your Discord build, and a **Scan Discord internals** button that lists navigation and chat components and copies the result to your clipboard.

> LayoutAnimation based fades (tap animations, channel switch) were removed: they have no visible effect on Discord builds that use React Native's new architecture.

## Install

GitHub builds and hosts the plugin automatically on every push to `main`.

1. One-time: repo **Settings → Pages → Source: GitHub Actions**.
2. Wait for the **Build & publish** run in the Actions tab to finish.
3. In Revenge: Plugins → Install → `https://dxckie-cell.github.io/Smooth-Ui/`

## Build locally

`npm install && npm run build` writes `dist/index.js` and `dist/manifest.json` (`npm run dev` for an unminified build, `npm run check` to type-check).

## How it works

Channel fade wraps the output of Discord's `ChannelMessages` component in an `Animated.View` and, when a `CHANNEL_SELECT` event is dispatched, dips its opacity and eases it back in on the native driver. Screen transitions override the `cardStyleInterpolator` / `transitionSpec` of react-navigation's JS stack (and `animation` on native stacks) just before each render.

## Credits

Settings UI helpers come from [nexpid's RevengePlugins](https://github.com/nexpid/RevengePlugins), licensed [CC BY 4.0](LICENSE).
