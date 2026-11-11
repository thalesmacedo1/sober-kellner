import type { Locale } from '@shared/i18n'
import { parseNumber, type Parsed } from './numbers'

export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE

const UNITS: Record<string, number> = {
  s: SECOND, sec: SECOND, secs: SECOND, second: SECOND, seconds: SECOND,
  seg: SECOND, segs: SECOND, segundo: SECOND, segundos: SECOND,
  min: MINUTE, mins: MINUTE, minute: MINUTE, minutes: MINUTE, minuto: MINUTE, minutos: MINUTE,
  h: HOUR, hr: HOUR, hrs: HOUR, hour: HOUR, hours: HOUR, hora: HOUR, horas: HOUR
}

const unitAt = (t: readonly string[], i: number): number | undefined =>
  t[i] !== undefined && Object.hasOwn(UNITS, t[i]) ? UNITS[t[i]] : undefined

/** "10min", "90s", "1h", "1h30", "1h30min" */
const COMPACT = /^(\d+(?:\.\d+)?)(h|hr|hrs|min|mins|m|s|sec|secs|seg)(?:(\d{1,2})(?:min|m)?)?$/

function parseCompact(token: string | undefined): number | null {
  const m = token ? COMPACT.exec(token) : null
  if (!m) return null
  const unit = m[2] === 'm' ? MINUTE : UNITS[m[2]]
  const extra = m[3] ? Number(m[3]) * (unit === HOUR ? MINUTE : SECOND) : 0
  return Number(m[1]) * unit + extra
}

/** "and a half" / "e meia" / "e meio" right after a unit. */
function parseTrailingHalf(t: readonly string[], i: number): number {
  if (t[i] === 'and' && t[i + 1] === 'a' && t[i + 2] === 'half') return 3
  if (t[i] === 'e' && (t[i + 1] === 'meia' || t[i + 1] === 'meio')) return 2
  return 0
}

function parsePart(t: readonly string[], i: number, locale: Locale): Parsed<number> | null {
  const compact = parseCompact(t[i])
  if (compact !== null) return { value: compact, next: i + 1 }

  // "meia hora", "half an hour", "half hour", "a half hour"
  if (t[i] === 'meia' && t[i + 1] === 'hora') return { value: 30 * MINUTE, next: i + 2 }
  if (t[i] === 'half' && t[i + 1] === 'an' && t[i + 2] === 'hour') return { value: 30 * MINUTE, next: i + 3 }
  if (t[i] === 'half' && t[i + 1] === 'hour') return { value: 30 * MINUTE, next: i + 2 }
  if (t[i] === 'a' && t[i + 1] === 'half' && t[i + 2] === 'hour') return { value: 30 * MINUTE, next: i + 3 }

  let amount: Parsed<number> | null = null
  if ((t[i] === 'a' || t[i] === 'an') && unitAt(t, i + 1)) amount = { value: 1, next: i + 1 }
  else amount = parseNumber(t, i, locale)
  if (!amount) return null

  const unit = unitAt(t, amount.next)
  if (!unit) return null
  let value = amount.value * unit
  let next = amount.next + 1
  const half = parseTrailingHalf(t, next)
  if (half) {
    value += unit / 2
    next += half
  }
  return { value, next }
}

/**
 * Parses a duration starting at `i`: "10 minutes", "1 hora e meia", "an hour and 15 minutes",
 * "2 minutos e 30 segundos", "1h30". Returns milliseconds.
 */
export function parseDuration(t: readonly string[], i: number, locale: Locale): Parsed<number> | null {
  const first = parsePart(t, i, locale)
  if (!first) return null
  let total = first.value
  let next = first.next
  for (;;) {
    const k = t[next] === 'and' || t[next] === 'e' || t[next] === ',' ? next + 1 : next
    const part = parsePart(t, k, locale)
    if (!part) break
    total += part.value
    next = part.next
  }
  return total > 0 ? { value: total, next } : null
}

export function parseDurationExact(t: readonly string[], locale: Locale): number | null {
  const r = parseDuration(t, 0, locale)
  return r && r.next === t.length ? r.value : null
}
