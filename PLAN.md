# sober-kellner — Plan

A desktop personal assistant (like Alexa) built with Electron. **No LLM**: it uses a classic voice-assistant
pipeline. Local speech-to-text turns speech into text, an intent classifier picks the action and extracts its
details, skill handlers carry it out, and local text-to-speech speaks the reply.

## Pipeline

```
Mic ──► Wake word ("Hey Kellner")  or  global hotkey
          │
          ▼
       Silero VAD  (records until you stop talking)
          │
          ▼
       whisper.cpp  (speech → text, local)
          │
          ▼
       NLU: phrase templates + own date/time parser  (text → intent + details)
          │        "remind me to call mom tomorrow at 3"
          │        → reminder.create { text: "call mom", when: <tomorrow 15:00> }
          ▼
       Skill router ──► skill handler ──► reply text + on-screen card
          │
          ▼
       Piper TTS  (text → voice, local)
```

## Stack

| Layer | Choice | Notes |
|---|---|---|
| App shell | Electron + TypeScript + electron-vite + React | Tray app + Spotlight-style overlay window |
| Audio pipeline | Electron `utilityProcess` | Keeps heavy audio work off the main process |
| Wake word | Porcupine *or* openWakeWord | See open questions |
| Voice detection | Silero VAD (onnxruntime-node) | Detects end of speech |
| Speech-to-text | whisper.cpp, separate background program (`base`/`small` model) | Offline, multilingual |
| Intent matching | Own phrase-template matcher (`src/main/nlu`) | Deterministic and testable, en + pt-BR. Replaced NLP.js in Phase 1. |
| Dates and times | Own parser (`src/main/nlu/when.ts`) | chrono-node's Portuguese was too weak ("15h", "daqui a…") |
| System control | Long-lived PowerShell helper (`resources/win-helper.ps1`) | Volume via Core Audio, media keys, lock, Start-menu app list |
| Text-to-speech | Piper 2023.11.14-2, long-lived process per voice | `pt_BR-faber-medium`, `en_US-lessac-medium`; `npm run models` downloads them |
| Storage | SQLite (built-in `node:sqlite`, no native module) | Timers, reminders, notes |
| Secrets and tokens | Electron `safeStorage` | Encrypted on disk, never in plain text or the repo |

## Skills (v1)

Each skill = phrase templates per intent and language + a handler. Template syntax: `(a|b)` choice,
`[a]` optional, `{slot}` captured words, e.g. `(set|start) [a] timer (for|of) {duration}`.

- **PC control:** open apps (Start Menu shortcut index), files and folders, volume and mute, media
  play/pause/next, lock, screenshot, sleep
- **Answers:** weather (Open-Meteo), Wikipedia summaries, math and unit conversion (mathjs), definitions,
  world clock. Anything else falls back to opening a web search in the browser.
- **Timers and reminders:** create/list/cancel, stored in SQLite (survive restart), notification + spoken alert
- **Calendar, email, notes:** Google Calendar/Gmail and/or Outlook via Microsoft Graph (desktop OAuth login),
  "what's on today", "new email?" (count, senders, subjects), "take a note…" (local markdown)

## Phases

0. ✅ **Scaffold:** electron-vite app, tray icon, overlay window, text input box, settings screen
1. ✅ **Brain via text:** NLU + skill router + PC control and timers, plus a test suite of phrases mapped to intents
2. ✅ **Voice out:** Piper TTS (one long-lived `--json-input` process per voice, played in a hidden window)
3. **Voice in:** hotkey → VAD → whisper
4. **Wake word:** always listening
5. **Answers skills**
6. **Integrations:** calendar, email, notes
7. **Polish:** auto-start, electron-builder packaging, listening and speaking animations, mic picker

Text input comes first so intent matching can be debugged without speaking every test.

## Trade-offs of going without an LLM

- Only understands phrasings close to its example phrases, so expanding them is ongoing work.
- No open-ended conversation; answers are limited to sources that return structured data.
- In exchange: free, private, offline (except web skills), instant responses.

## Open questions

1. ~~Language: pt-BR, English, or both?~~ Both (decided).
2. Wake word engine: Porcupine (easy, free personal key) or openWakeWord (fully open, train in Colab)?
3. Name / wake word: "Kellner"?
4. Accounts: Google, Microsoft, or both?
