import type { Locale } from '@shared/i18n'

type Vars = Record<string, string | number>

/** Per-skill bilingual message table → `say(locale, key, vars)`. */
export function messages<K extends string>(table: Record<Locale, Record<K, string>>) {
  return (locale: Locale, key: K, vars?: Vars): string =>
    table[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ''))
}

const UNIT_WORDS: Record<Locale, Record<'h' | 'm' | 's', [string, string]>> = {
  en: { h: ['hour', 'hours'], m: ['minute', 'minutes'], s: ['second', 'seconds'] },
  'pt-BR': { h: ['hora', 'horas'], m: ['minuto', 'minutos'], s: ['segundo', 'segundos'] }
}

export function joinList(items: string[], locale: Locale): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
}

/** 5_400_000 → "1 hour and 30 minutes" / "1 hora e 30 minutos". Seconds are dropped above 1 hour. */
export function formatDuration(ms: number, locale: Locale): string {
  let total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  total -= h * 3600
  const m = Math.floor(total / 60)
  const s = total - m * 60
  const words = UNIT_WORDS[locale]
  const part = (n: number, unit: 'h' | 'm' | 's'): string => `${n} ${words[unit][n === 1 ? 0 : 1]}`
  const parts: string[] = []
  if (h) parts.push(part(h, 'h'))
  if (m) parts.push(part(m, 'm'))
  if (s && !h) parts.push(part(s, 's'))
  if (parts.length === 0) parts.push(part(0, 's'))
  return joinList(parts, locale)
}

export function formatTime(date: Date, locale: Locale): string {
  // pt-BR: "09:00" (24h, zero-padded); en: "9:00 AM"
  return new Intl.DateTimeFormat(locale, { hour: locale === 'pt-BR' ? '2-digit' : 'numeric', minute: '2-digit' }).format(date)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "today at 3:00 PM", "amanhã às 15:00", "on Friday at 9:00 AM", "em 20 de nov. às 10:00" */
export function formatWhen(date: Date, now: Date, locale: Locale): string {
  const time = formatTime(date, locale)
  const pt = locale === 'pt-BR'
  const atTime = pt ? `às ${time}` : `at ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(date, now)) return `${pt ? 'hoje' : 'today'} ${atTime}`
  if (sameDay(date, tomorrow)) return `${pt ? 'amanhã' : 'tomorrow'} ${atTime}`
  const days = (date.getTime() - now.getTime()) / 86_400_000
  if (days < 6.5) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    return pt ? `${weekday} ${atTime}` : `on ${weekday} ${atTime}`
  }
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date)
  return pt ? `em ${day} ${atTime}` : `on ${day} ${atTime}`
}
