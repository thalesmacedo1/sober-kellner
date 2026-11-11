import type { LanguageSetting, Locale } from './i18n'

export interface Settings {
  language: LanguageSetting
  hotkey: string
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  hotkey: 'CommandOrControl+Shift+Space'
}

export interface AppState {
  settings: Settings
  locale: Locale
}

export interface AssistantReply {
  text: string
  kind: 'ok' | 'unknown' | 'error'
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
}

export const IPC = {
  getState: 'state:get',
  saveSettings: 'settings:save',
  stateChanged: 'state:changed',
  query: 'assistant:query',
  hideOverlay: 'overlay:hide',
  resizeOverlay: 'overlay:resize',
  overlayShown: 'overlay:shown'
} as const
