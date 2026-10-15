# Smooth UI

A [Revenge](https://github.com/revenge-mod) plugin for Discord mobile that makes the interface feel smoother: things that appear or disappear **cross-fade** instead of popping, like the Server pins / Local pins switch in Local Pins.

## Features

- **Channel fade:** the chat fades in when you switch channels (2 s by default).
- **Send animation:** the message bar squeezes and flashes when you send a message, once per message.
- **Speed:** how long the animations take.
- **Respect reduce motion:** animations are skipped when your phone's reduce motion setting is on.

The **Status** section shows whether each feature is active, or why it couldn't start.

## Install

GitHub builds and hosts the plugin automatically on every push to `main`.

1. One-time: repo **Settings → Pages → Source: GitHub Actions**.
2. Wait for the **Build & publish** run in the Actions tab to finish.
3. In Revenge: Plugins → Install → `https://dxckie-cell.github.io/Smooth-Ui/`

## Build locally

`npm install && npm run build` writes `dist/index.js` and `dist/manifest.json` (`npm run dev` for an unminified build, `npm run check` to type-check).

## How it works

Both features use React Native's `Animated` with the native driver. Channel fade lays a cover in the chat's background colour over Discord's `ChatViewWrapperBase` (absolutely positioned, so the layout is untouched) and fades it out on `CHANNEL_SELECT`. Send animation wraps the `ChatInputGuardWrapper` input bar and plays when your own `MESSAGE_CREATE` arrives, deduplicated by message nonce.

## Credits

Settings UI helpers come from [nexpid's RevengePlugins](https://github.com/nexpid/RevengePlugins), licensed [CC BY 4.0](LICENSE).
