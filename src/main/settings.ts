import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { LOCALES, type LanguageSetting } from '@shared/i18n'
import { DEFAULT_SETTINGS, type Settings } from '@shared/ipc'

const file = (): string => join(app.getPath('userData'), 'settings.json')

function isLanguage(value: unknown): value is LanguageSetting {
  return value === 'auto' || (LOCALES as readonly unknown[]).includes(value)
}

export function sanitize(input: Partial<Settings> | undefined): Settings {
  return {
    language: isLanguage(input?.language) ? input.language : DEFAULT_SETTINGS.language,
    hotkey:
      typeof input?.hotkey === 'string' && input.hotkey.trim()
        ? input.hotkey.trim()
        : DEFAULT_SETTINGS.hotkey,
    voice: typeof input?.voice === 'boolean' ? input.voice : DEFAULT_SETTINGS.voice
  }
}

export function loadSettings(): Settings {
  try {
    return sanitize(JSON.parse(readFileSync(file(), 'utf8')))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function persistSettings(settings: Settings): void {
  mkdirSync(dirname(file()), { recursive: true })
  writeFileSync(file(), JSON.stringify(settings, null, 2), 'utf8')
}
