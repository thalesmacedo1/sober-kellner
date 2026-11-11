import type { LanguageSetting, Locale } from './i18n'

export interface Settings {
  language: LanguageSetting
  hotkey: string
  /** Speak replies and alerts out loud */
  voice: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  hotkey: 'CommandOrControl+Shift+Space',
  voice: true
}

export interface AppState {
  settings: Settings
  locale: Locale
  /** Piper and its voices are downloaded (`npm run models`) */
  voiceAvailable: boolean
}

export interface AssistantReply {
  text: string
  kind: 'ok' | 'unknown' | 'error'
  /** language the reply is written in (the user's language, not necessarily the UI's) */
  locale: Locale
  /** id of the intent that handled the request, e.g. "timer.set" */
  intent?: string
  /** the overlay should hide itself shortly after showing this reply */
  dismiss?: boolean
}

export type SaveSettingsResult = { ok: true; state: AppState } | { ok: false; error: 'hotkey' }

/** API exposed to the renderer by the preload script as `window.kellner`. */
export interface KellnerApi {
  getState(): Promise<AppState>
  saveSettings(settings: Settings): Promise<SaveSettingsResult>
  onStateChanged(listener: (state: AppState) => void): () => void
  query(text: string): Promise<AssistantReply>
  hideOverlay(): void
  resizeOverlay(height: number): void
  /** Fired each time the overlay is shown, so the input can refocus and reset. */
  onOverlayShown(listener: () => void): () => void
  /** Cut off the reply being spoken. */
  stopSpeaking(): void
  /** true while a reply is being spoken. */
  onSpeaking(listener: (speaking: boolean) => void): () => void

  // Used only by the hidden audio window (#/audio), which plays the synthesized speech.
  onAudioPlay(listener: (wav: Uint8Array) => void): () => void
  onAudioStop(listener: () => void): () => void
  reportSpeaking(speaking: boolean): void
}

export const IPC = {
  getState: 'state:get',
  saveSettings: 'settings:save',
  stateChanged: 'state:changed',
  query: 'assistant:query',
  hideOverlay: 'overlay:hide',
  resizeOverlay: 'overlay:resize',
  overlayShown: 'overlay:shown',
  stopSpeaking: 'speech:stop',
  speaking: 'speech:speaking',
  audioPlay: 'audio:play',
  audioStop: 'audio:stop',
  audioState: 'audio:state'
} as const
