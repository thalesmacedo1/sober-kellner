# sober-kellner

A desktop voice assistant (like Alexa) built with Electron. Fully local, with no LLM: requests go through
intent matching and skill handlers. Supports English and Português (Brasil). See [PLAN.md](PLAN.md).

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # start with hot reload
npm test           # phrase → intent table, date/time parsing, skills, scheduler
npm run typecheck
npm run build
```

### Teaching it a new phrase

1. Add the phrase and its expected intent to `tests/nlu.test.ts` (`EN` or `PT` table).
2. Run `npm test` and watch it fail.
3. Add or widen a template in the skill (`src/main/skills/…`). Syntax: `(a|b)` choice, `[a]` optional,
   `{slot}` captured words.

- **Ctrl+Shift+Space** (configurable) toggles the assistant overlay. Esc or clicking away hides it.
- The tray icon menu has Open / Settings / Quit. Clicking the icon toggles the overlay.
- Settings (language and hotkey) are stored in `%APPDATA%/sober-kellner/settings.json`.

## Layout

```
src/
  main/
    nlu/        tokenizer, template matcher, numbers, durations, date/time parser
    skills/     system (time/date/help), pc (apps, folders, volume, media, lock, screenshot), timers
    services/   scheduler (SQLite), Windows helper client, PC service
    assistant.ts  text → NLU → skill → reply
  preload/    Secure bridge exposing window.kellner to the UI
  renderer/   React UI: overlay (#/overlay) and settings (#/settings)
  shared/     Code used by both sides: i18n strings, IPC contract
resources/    Icons, win-helper.ps1
tests/        Vitest suites
```
