# sober-kellner

A desktop voice assistant (like Alexa) built with Electron. Fully local, with no LLM: requests go through
intent matching and skill handlers. Supports English and Português (Brasil). See [PLAN.md](PLAN.md).

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # start with hot reload
npm run typecheck
npm run build
```

- **Ctrl+Shift+Space** (configurable) toggles the assistant overlay. Esc or clicking away hides it.
- The tray icon menu has Open / Settings / Quit. Clicking the icon toggles the overlay.
- Settings (language and hotkey) are stored in `%APPDATA%/sober-kellner/settings.json`.

## Layout

```
src/
  main/       Electron main process: tray, hotkey, windows, settings, assistant entry point
  preload/    Secure bridge exposing window.kellner to the UI
  renderer/   React UI: overlay (#/overlay) and settings (#/settings)
  shared/     Code used by both sides: i18n strings, IPC contract
resources/    Icons
```
