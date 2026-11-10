export const LOCALES = ['en', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]
export type LanguageSetting = Locale | 'auto'

const en = {
  'app.name': 'Kellner',
  'overlay.placeholder': 'Ask me something…',
  'overlay.hint': 'Enter to send · Esc to close',
  'overlay.thinking': 'Thinking…',
  'reply.echo': 'I heard: "{text}". I can’t do anything yet — skills arrive in Phase 1.',
  'tray.open': 'Open assistant',
  'tray.settings': 'Settings…',
  'tray.quit': 'Quit',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.language.auto': 'Automatic (system)',
  'settings.hotkey': 'Global hotkey',
  'settings.hotkey.help': 'Electron accelerator format, e.g. CommandOrControl+Shift+Space',
  'settings.save': 'Save',
  'settings.saved': 'Saved',
  'settings.error.hotkey': 'Couldn’t register this hotkey — it may be in use by another app.'
} as const

export type MessageKey = keyof typeof en

const ptBR: Record<MessageKey, string> = {
  'app.name': 'Kellner',
  'overlay.placeholder': 'Pergunte alguma coisa…',
  'overlay.hint': 'Enter para enviar · Esc para fechar',
  'overlay.thinking': 'Pensando…',
  'reply.echo': 'Ouvi: "{text}". Ainda não sei fazer nada — as habilidades chegam na Fase 1.',
  'tray.open': 'Abrir assistente',
  'tray.settings': 'Configurações…',
  'tray.quit': 'Sair',
  'settings.title': 'Configurações',
  'settings.language': 'Idioma',
  'settings.language.auto': 'Automático (sistema)',
  'settings.hotkey': 'Atalho global',
  'settings.hotkey.help': 'Formato de acelerador do Electron, ex.: CommandOrControl+Shift+Space',
  'settings.save': 'Salvar',
  'settings.saved': 'Salvo',
  'settings.error.hotkey': 'Não foi possível registrar este atalho — talvez outro app já o use.'
}

const messages: Record<Locale, Record<MessageKey, string>> = { en, 'pt-BR': ptBR }

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' }

export function resolveLocale(setting: LanguageSetting, systemLocale: string): Locale {
  if (setting !== 'auto') return setting
  return systemLocale.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

export type Translate = (key: MessageKey, vars?: Record<string, string>) => string

export function createTranslator(locale: Locale): Translate {
  return (key, vars) =>
    messages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => vars?.[name] ?? `{${name}}`)
}
