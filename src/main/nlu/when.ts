import type { Locale } from '@shared/i18n'
import { parseDuration } from './duration'
import { parseNumber } from './numbers'
import { startsWithAt } from './text'

/**
 * Finds a point in time inside a phrase, in English or Portuguese:
 *   "in 10 minutes", "daqui a meia hora", "tomorrow at 3pm", "amanhã às 15h",
 *   "sexta às 9", "next monday morning", "hoje à noite", "dia 20 às 10h30", "at noon".
 * Returns the resolved date and which token ranges were used, so callers can remove them
 * (e.g. the reminder text is what's left).
 */
export interface WhenResult {
  date: Date
  /** [start, end) token ranges consumed */
  spans: Array<[number, number]>
  /** false when only a day was given ("tomorrow") and a default time was used */
  hasTime: boolean
}

type Period = 'morning' | 'afternoon' | 'evening'
type Meridiem = 'am' | 'pm'

interface Span { start: number; next: number }
interface RelativeHit extends Span { kind: 'relative'; ms: number }
interface DayHit extends Span { kind: 'day'; date: Date; period?: Period }
interface TimeHit extends Span { kind: 'time'; hour: number; minute: number; meridiem?: Meridiem; fixed: boolean }
interface PeriodHit extends Span { kind: 'period'; period: Period }
type Hit = RelativeHit | DayHit | TimeHit | PeriodHit

const PERIOD_DEFAULT_HOUR: Record<Period, number> = { morning: 9, afternoon: 15, evening: 20 }
const DEFAULT_REMINDER_HOUR = 9

const WEEKDAYS: Record<Locale, Record<string, number>> = {
  en: { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 },
  'pt-BR': { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 }
}

function firstPrefix(t: readonly string[], i: number, prefixes: readonly string[][]): number {
  for (const p of prefixes) if (startsWithAt(t, i, p)) return p.length
  return -1
}

function startOfDay(d: Date, addDays = 0): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() + addDays)
  return r
}

// ---------- relative: "in 10 minutes", "daqui a 2 horas", "10 minutes from now" ----------

const RELATIVE_PREFIXES: Record<Locale, string[][]> = {
  en: [['in', 'about'], ['in'], ['within']],
  'pt-BR': [['daqui', 'a'], ['daqui'], ['dentro', 'de'], ['em']]
}

function matchRelative(t: readonly string[], i: number, locale: Locale): RelativeHit | null {
  const len = firstPrefix(t, i, RELATIVE_PREFIXES[locale])
  if (len > 0) {
    const d = parseDuration(t, i + len, locale)
    if (d) return { kind: 'relative', ms: d.value, start: i, next: d.next }
  }
  if (locale === 'en') {
    const d = parseDuration(t, i, locale)
    if (d && t[d.next] === 'from' && t[d.next + 1] === 'now') {
      return { kind: 'relative', ms: d.value, start: i, next: d.next + 2 }
    }
  }
  return null
}

// ---------- day: "today", "amanhã", "friday", "sexta-feira que vem", "dia 20" ----------

function weekdayDate(now: Date, weekday: number): Date {
  const diff = (weekday - now.getDay() + 7) % 7
  return startOfDay(now, diff === 0 ? 7 : diff)
}

function dayOfMonthDate(now: Date, day: number): Date | null {
  if (day < 1 || day > 31) return null
  const d = startOfDay(now)
  d.setDate(day)
  if (d.getDate() !== day) return null // e.g. 31 in a 30-day month
  if (d < startOfDay(now)) d.setMonth(d.getMonth() + 1)
  return d
}

function matchDay(t: readonly string[], i: number, locale: Locale, now: Date): DayHit | null {
  const hit = (len: number, date: Date, period?: Period): DayHit => ({
    kind: 'day', date, period, start: i, next: i + len
  })

  if (locale === 'en') {
    if (t[i] === 'today') return hit(1, startOfDay(now))
    if (t[i] === 'tonight') return hit(1, startOfDay(now), 'evening')
    if (t[i] === 'tomorrow') return hit(1, startOfDay(now, 1))
    const dat = startsWithAt(t, i, ['the', 'day', 'after', 'tomorrow']) ? 4 : startsWithAt(t, i, ['day', 'after', 'tomorrow']) ? 3 : 0
    if (dat) return hit(dat, startOfDay(now, 2))

    let j = i
    while (t[j] === 'on' || t[j] === 'next' || t[j] === 'this' || t[j] === 'the') j++
    const wd = WEEKDAYS.en[t[j] ?? '']
    if (wd !== undefined) return hit(j + 1 - i, weekdayDate(now, wd))
    const ord = /^(\d{1,2})(st|nd|rd|th)$/.exec(t[j] ?? '')
    if (ord) {
      const d = dayOfMonthDate(now, Number(ord[1]))
      if (d) return hit(j + 1 - i, d)
    }
    return null
  }

  if (t[i] === 'hoje') return hit(1, startOfDay(now))
  if (t[i] === 'amanha') return hit(1, startOfDay(now, 1))
  if (startsWithAt(t, i, ['depois', 'de', 'amanha'])) return hit(3, startOfDay(now, 2))

  let j = i
  while (['na', 'no', 'nesta', 'neste', 'nessa', 'nesse', 'esta', 'este', 'essa', 'esse', 'proxima', 'proximo'].includes(t[j] ?? '')) j++
  const wd = WEEKDAYS['pt-BR'][t[j] ?? '']
  if (wd !== undefined) {
    let next = j + 1
    if (t[next] === 'feira') next++
    if (t[next] === 'que' && t[next + 1] === 'vem') next += 2
    return hit(next - i, weekdayDate(now, wd))
  }
  if (t[i] === 'dia' || (t[i] === 'no' && t[i + 1] === 'dia')) {
    const k = t[i] === 'dia' ? i + 1 : i + 2
    const n = parseNumber(t, k, locale)
    const d = n ? dayOfMonthDate(now, n.value) : null
    if (n && d) return hit(n.next - i, d)
  }
  return null
}

// ---------- period: "in the morning", "à tarde", "de noite" ----------

const PERIODS: Record<Locale, Array<[string[], Period]>> = {
  en: [
    [['in', 'the', 'morning'], 'morning'], [['this', 'morning'], 'morning'], [['morning'], 'morning'],
    [['in', 'the', 'afternoon'], 'afternoon'], [['this', 'afternoon'], 'afternoon'], [['afternoon'], 'afternoon'],
    [['in', 'the', 'evening'], 'evening'], [['this', 'evening'], 'evening'], [['evening'], 'evening'],
    [['at', 'night'], 'evening'], [['night'], 'evening']
  ],
  'pt-BR': [
    [['de', 'manha'], 'morning'], [['da', 'manha'], 'morning'], [['pela', 'manha'], 'morning'],
    [['de', 'madrugada'], 'morning'], [['da', 'madrugada'], 'morning'],
    [['de', 'tarde'], 'afternoon'], [['da', 'tarde'], 'afternoon'], [['a', 'tarde'], 'afternoon'], [['pela', 'tarde'], 'afternoon'],
    [['de', 'noite'], 'evening'], [['da', 'noite'], 'evening'], [['a', 'noite'], 'evening'], [['pela', 'noite'], 'evening']
  ]
}

function matchPeriod(t: readonly string[], i: number, locale: Locale): PeriodHit | null {
  for (const [words, period] of PERIODS[locale]) {
    if (startsWithAt(t, i, words)) return { kind: 'period', period, start: i, next: i + words.length }
  }
  return null
}

// ---------- time: "at 3pm", "às 15h30", "at 3:30", "às três e meia", "at noon" ----------

const TIME_PREFIXES: Record<Locale, string[][]> = {
  en: [['at', 'around'], ['at', 'about'], ['at'], ['around'], ['by']],
  'pt-BR': [['por', 'volta', 'das'], ['por', 'volta', 'da'], ['la', 'pelas'], ['pelas'], ['as'], ['ao'], ['a']]
}

function matchTime(t: readonly string[], i: number, locale: Locale): TimeHit | null {
  const prefixLen = Math.max(0, firstPrefix(t, i, TIME_PREFIXES[locale]))
  const j = i + prefixLen
  const hit = (next: number, hour: number, minute: number, fixed: boolean, meridiem?: Meridiem): TimeHit => ({
    kind: 'time', hour, minute, meridiem, fixed, start: i, next
  })

  if (t[j] === 'noon' || t[j] === 'midday') return hit(j + 1, 12, 0, true)
  if (t[j] === 'midnight') return hit(j + 1, 0, 0, true)
  if (startsWithAt(t, j, ['meio', 'dia'])) return hit(j + 2, 12, 0, true)
  if (startsWithAt(t, j, ['meia', 'noite'])) return hit(j + 2, 0, 0, true)

  const w = t[j] ?? ''
  let m: RegExpExecArray | null
  let hour: number
  let minute = 0
  let next = j + 1
  let meridiem: Meridiem | undefined
  let fixed = false

  if ((m = /^(\d{1,2}):(\d{2})(am|pm)?$/.exec(w))) {
    hour = Number(m[1]); minute = Number(m[2]); meridiem = m[3] as Meridiem | undefined
    fixed = m[1].length === 2 && m[1].startsWith('0')
  } else if ((m = /^(\d{1,2})h(\d{2})?(?:min)?$/.exec(w))) {
    hour = Number(m[1]); minute = Number(m[2] ?? 0); fixed = true // "15h", "9h30": stated on a 24h clock
  } else if ((m = /^(\d{1,2})(am|pm)$/.exec(w))) {
    hour = Number(m[1]); meridiem = m[2] as Meridiem
  } else {
    const n = parseNumber(t, j, locale)
    if (!n || !Number.isInteger(n.value)) return null
    hour = n.value
    next = n.next
    const unitFollows = ['am', 'pm', 'oclock', 'horas', 'hora', 'h'].includes(t[next] ?? '') ||
      (t[next] === 'a' && t[next + 1] === 'm') || (t[next] === 'p' && t[next + 1] === 'm')
    if (prefixLen === 0 && !unitFollows) return null // a bare number isn't a time
    if (t[next] === 'horas' || t[next] === 'hora' || t[next] === 'h') { next++; fixed = hour > 12 }
  }

  // trailing meridiem / minutes
  if (!meridiem) {
    if (t[next] === 'am' || t[next] === 'pm') { meridiem = t[next] as Meridiem; next++ }
    else if ((t[next] === 'a' || t[next] === 'p') && t[next + 1] === 'm' && locale === 'en') {
      meridiem = t[next] === 'a' ? 'am' : 'pm'; next += 2
    }
  }
  if (t[next] === 'oclock') next++
  if (minute === 0 && locale === 'pt-BR' && t[next] === 'e') {
    if (t[next + 1] === 'meia') { minute = 30; next += 2 }
    else {
      const mins = parseNumber(t, next + 1, locale)
      if (mins && mins.value > 0 && mins.value < 60) {
        minute = mins.value
        next = mins.next
        if (t[next] === 'minutos' || t[next] === 'min') next++
      }
    }
  } else if (minute === 0 && locale === 'en' && !/[:h]/.test(w)) {
    // "three thirty", "at 3 45"
    const mins = parseNumber(t, next, locale)
    if (mins && mins.value >= 10 && mins.value < 60 && Number.isInteger(mins.value)) {
      minute = mins.value
      next = mins.next
      if (t[next] === 'am' || t[next] === 'pm') { meridiem = t[next] as Meridiem; next++ }
    }
  }

  if (hour > 23 || minute > 59) return null
  if (hour === 0 || hour > 12) fixed = true
  return hit(next, hour, minute, fixed, meridiem)
}

// ---------- combine ----------

function applyHour(time: TimeHit, period: Period | undefined, hasDay: boolean): number[] {
  let h = time.hour
  if (time.meridiem === 'pm' && h < 12) return [h + 12]
  if (time.meridiem === 'am') return [h === 12 ? 0 : h]
  if (time.fixed || h === 12) return [h]
  if (period === 'afternoon' || period === 'evening') return [h + 12]
  if (period === 'morning') return [h]
  if (hasDay) return [h <= 5 ? h + 12 : h] // "tomorrow at 3" → 15:00, "tomorrow at 7" → 07:00
  return [h, h + 12] // ambiguous: caller picks the next one that's in the future
}

function at(day: Date, hour: number, minute: number): Date {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function findWhen(tokens: readonly string[], locale: Locale, now: Date): WhenResult | null {
  let relative: RelativeHit | undefined
  let day: DayHit | undefined
  let time: TimeHit | undefined
  let period: PeriodHit | undefined

  for (let i = 0; i < tokens.length; ) {
    const h: Hit | null =
      (!relative && matchRelative(tokens, i, locale)) ||
      (!day && matchDay(tokens, i, locale, now)) ||
      (!time && matchTime(tokens, i, locale)) ||
      (!period && matchPeriod(tokens, i, locale)) ||
      null
    if (!h) { i++; continue }
    if (h.kind === 'relative') relative = h
    else if (h.kind === 'day') day = h
    else if (h.kind === 'time') time = h
    else period = h
    i = h.next
  }

  if (relative) {
    return { date: new Date(now.getTime() + relative.ms), spans: [[relative.start, relative.next]], hasTime: true }
  }
  if (!day && !time && !period) return null

  const spans = [day, time, period]
    .filter((h): h is DayHit | TimeHit | PeriodHit => !!h)
    .map((h): [number, number] => [h.start, h.next])
  const base = day?.date ?? startOfDay(now)
  const effectivePeriod = period?.period ?? day?.period

  if (time) {
    for (const hour of applyHour(time, effectivePeriod, !!day)) {
      const d = at(base, hour, time.minute)
      if (day || d > now) return { date: d, spans, hasTime: true }
    }
    // every candidate today has passed → tomorrow
    const [hour] = applyHour(time, effectivePeriod, true)
    return { date: at(startOfDay(now, 1), hour, time.minute), spans, hasTime: true }
  }

  if (effectivePeriod) {
    let d = at(base, PERIOD_DEFAULT_HOUR[effectivePeriod], 0)
    if (!day && d <= now) d = at(startOfDay(now, 1), PERIOD_DEFAULT_HOUR[effectivePeriod], 0)
    return { date: d, spans, hasTime: true }
  }

  let d = at(base, DEFAULT_REMINDER_HOUR, 0)
  if (d <= now) d = new Date(now.getTime() + 60 * 60 * 1000)
  return { date: d, spans, hasTime: false }
}
