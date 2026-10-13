# Smooth UI

A [Revenge](https://github.com/revenge-mod) plugin for Discord mobile that makes the interface feel smoother: things that appear or disappear **cross-fade** instead of popping, like the Server pins / Local pins switch in Local Pins.

## Features

- **Tap animations:** whatever changes on screen right after you tap something (a panel opening, a list swapping, a row expanding) fades in and out. It hooks `Pressable`, `TouchableOpacity` and `TouchableHighlight`, so it covers most of Discord's buttons and rows.
- **Channel switch fade:** cross-fades the chat when you open a channel and when its messages arrive.
- **Move animations (off by default):** also animates things sliding and resizing, not only fading. It can look odd in message lists, so try it and see.
- **Speed:** Fast, Normal, Smooth or Slow. The **Preview** row shows a box appearing and disappearing with your current settings.
- **Screen transitions (experimental, off by default):** replaces the animation when opening and closing screens with a fade or slide + fade. It depends on Discord's navigation internals, so check the **Status** section to see whether it found them. On native stacks only Fade works.
- **Respect reduce motion:** all animations are skipped when your phone's reduce motion setting is on.

The **Status** section in the plugin's settings shows whether each feature is active or why it couldn't start, so a Discord update that breaks one feature doesn't take the others down.

## Install

GitHub builds and hosts the plugin automatically on every push to `main`.

1. One-time: repo **Settings → Pages → Source: GitHub Actions**.
2. Wait for the **Build & publish** run in the Actions tab to finish.
3. In Revenge: Plugins → Install → `https://dxckie-cell.github.io/Smooth-Ui/`

## Build locally

`npm install && npm run build` writes `dist/index.js` and `dist/manifest.json` (`npm run dev` for an unminified build, `npm run check` to type-check).

## How it works

Everything is built on React Native's `LayoutAnimation`: right before a tap handler runs (or a channel switch is dispatched), the plugin asks React Native to animate the next layout pass. Views that get created fade in, views that get removed fade out, and, with Move animations on, views that change position or size glide to their new spot. Screen transitions override the `cardStyleInterpolator` / `transitionSpec` of react-navigation's stack.

## Credits

Settings UI helpers come from [nexpid's RevengePlugins](https://github.com/nexpid/RevengePlugins), licensed [CC BY 4.0](LICENSE).
