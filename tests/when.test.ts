import { describe, expect, it } from 'vitest'
import type { Locale } from '@shared/i18n'
import { normalizeText } from '../src/main/nlu/text'
import { findWhen } from '../src/main/nlu/when'
import { parseDurationExact, MINUTE, SECOND, HOUR } from '../src/main/nlu/duration'
import { NOW } from './helpers'

// NOW = Wed 2026-11-11 10:00
const fmt = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

const when = (locale: Locale, text: string): string | null => {
  const r = findWhen(normalizeText(text).split(' '), locale, NOW)
  return r ? fmt(r.date) : null
}

describe('findWhen — English', () => {
  const cases: Array<[string, string | null]> = [
    ['in 10 minutes', '2026-11-11 10:10'],
    ['in an hour and a half', '2026-11-11 11:30'],
    ['20 minutes from now', '2026-11-11 10:20'],
    ['tomorrow at 3pm', '2026-11-12 15:00'],
    ['tomorrow at 3', '2026-11-12 15:00'],
    ['tomorrow at 7', '2026-11-12 07:00'],
    ['at 3', '2026-11-11 15:00'],
    ['at 9', '2026-11-11 21:00'],
    ['at 11:30', '2026-11-11 11:30'],
    ['at 9am', '2026-11-12 09:00'],
    ['at noon', '2026-11-11 12:00'],
    ['tonight', '2026-11-11 20:00'],
    ['tonight at 8', '2026-11-11 20:00'],
    ['friday at 9am', '2026-11-13 09:00'],
    ['next monday morning', '2026-11-16 09:00'],
    ['on wednesday at 5pm', '2026-11-18 17:00'],
    ['at 3 30 pm', '2026-11-11 15:30'],
    ['tomorrow', '2026-11-12 09:00'],
    ['on the 20th at 10am', '2026-11-20 10:00'],
    ['call mom', null]
  ]
  for (const [text, expected] of cases) it(`${text} → ${expected}`, () => expect(when('en', text)).toBe(expected))
})

describe('findWhen — Português', () => {
  const cases: Array<[string, string | null]> = [
    ['daqui a 10 minutos', '2026-11-11 10:10'],
    ['em meia hora', '2026-11-11 10:30'],
    ['daqui a uma hora e meia', '2026-11-11 11:30'],
    ['amanhã às 15h', '2026-11-12 15:00'],
    ['amanha as 15h30', '2026-11-12 15:30'],
    ['amanhã às 3 da tarde', '2026-11-12 15:00'],
    ['amanhã às 3', '2026-11-12 15:00'],
    ['amanhã às 7', '2026-11-12 07:00'],
    ['às 17h', '2026-11-11 17:00'],
    ['às 9h', '2026-11-12 09:00'],
    ['às 3', '2026-11-11 15:00'],
    ['às três e meia', '2026-11-11 15:30'],
    ['hoje à noite', '2026-11-11 20:00'],
    ['hoje às 20h', '2026-11-11 20:00'],
    ['sexta às 9', '2026-11-13 09:00'],
    ['sexta-feira que vem às 10h', '2026-11-13 10:00'],
    ['segunda de manhã', '2026-11-16 09:00'],
    ['ao meio-dia', '2026-11-11 12:00'],
    ['depois de amanhã às 8h', '2026-11-13 08:00'],
    ['dia 20 às 10h', '2026-11-20 10:00'],
    ['amanhã', '2026-11-12 09:00'],
    ['ligar pra mãe', null]
  ]
  for (const [text, expected] of cases) it(`${text} → ${expected}`, () => expect(when('pt-BR', text)).toBe(expected))
})

describe('parseDurationExact', () => {
  const cases: Array<[Locale, string, number | null]> = [
    ['en', '10 minutes', 10 * MINUTE],
    ['en', 'an hour', HOUR],
    ['en', 'half an hour', 30 * MINUTE],
    ['en', '1 hour 15 minutes', 75 * MINUTE],
    ['en', '90s', 90 * SECOND],
    ['en', '1.5 hours', 90 * MINUTE],
    ['pt-BR', 'dez minutos', 10 * MINUTE],
    ['pt-BR', 'uma hora e meia', 90 * MINUTE],
    ['pt-BR', 'um minuto e meio', 90 * SECOND],
    ['pt-BR', '1,5 horas', 90 * MINUTE],
    ['pt-BR', 'quarenta e cinco segundos', 45 * SECOND],
    ['pt-BR', '2 horas e 15 minutos', 135 * MINUTE],
    ['en', 'banana', null],
    ['pt-BR', 'cinco', null]
  ]
  for (const [locale, text, expected] of cases) {
    it(`${locale}: ${text}`, () => expect(parseDurationExact(normalizeText(text).split(' '), locale)).toBe(expected))
  }
})
