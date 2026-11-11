import type { Locale } from '@shared/i18n'
import type { Intent, Skill, SlotType, SlotValue } from '../skills/types'
import { parseDurationExact } from './duration'
import { compilePattern } from './grammar'
import { parseNumberExact, parsePercent } from './numbers'
import { stripFillers, tokenize, type Token } from './text'

interface CompiledPattern {
  intent: Intent
  locale: Locale
  pattern: string
  regex: RegExp
}

export interface NluMatch {
  intent: Intent
  locale: Locale
  slots: Record<string, SlotValue>
  /** the template that matched — handy for debugging and tests */
  pattern: string
}

function parseSlot(type: SlotType, words: string[], locale: Locale): number | null | undefined {
  switch (type) {
    case 'text':
      return undefined
    case 'duration':
      return parseDurationExact(words, locale)
    case 'number':
      return parseNumberExact(words, locale)
    case 'percent':
      return parsePercent(words, locale)
  }
}

/**
 * Matches user input against every skill's phrase templates (both languages).
 * When several templates match, the one with the most literal (non-slot) text wins;
 * ties go to the user's UI language, then to registration order.
 */
export class Nlu {
  private readonly compiled: CompiledPattern[] = []

  constructor(skills: Skill[]) {
    for (const skill of skills) {
      for (const intent of skill.intents) {
        for (const [locale, patterns] of Object.entries(intent.patterns) as Array<[Locale, string[]]>) {
          for (const pattern of patterns) {
            this.compiled.push({ intent, locale, pattern, regex: compilePattern(pattern) })
          }
        }
      }
    }
  }

  parse(text: string, preferred: Locale): NluMatch | null {
    const tokens = stripFillers(tokenize(text))
    if (tokens.length === 0) return null

    const joined = ` ${tokens.map((t) => t.norm).join(' ')} `
    const starts = new Map<number, number>()
    const ends = new Map<number, number>()
    let pos = 1
    tokens.forEach((t, i) => {
      starts.set(pos, i)
      ends.set(pos + t.norm.length, i)
      pos += t.norm.length + 1
    })

    let best: { match: NluMatch; score: number } | null = null

    for (const c of this.compiled) {
      const m = c.regex.exec(joined)
      if (!m) continue

      const slots: Record<string, SlotValue> = {}
      let slotChars = 0
      let ok = true
      for (const [name, range] of Object.entries(m.indices?.groups ?? {})) {
        if (!range) continue // slot inside an optional part that wasn't used
        const a = starts.get(range[0])
        const b = ends.get(range[1])
        if (a === undefined || b === undefined) { ok = false; break }
        const slotTokens: Token[] = tokens.slice(a, b + 1)
        const value = parseSlot(c.intent.slots?.[name] ?? 'text', slotTokens.map((t) => t.norm), c.locale)
        if (value === null) { ok = false; break }
        slots[name] = {
          text: text.slice(slotTokens[0].start, slotTokens[slotTokens.length - 1].end),
          tokens: slotTokens,
          source: text,
          value
        }
        slotChars += range[1] - range[0]
      }
      if (!ok) continue

      const score = joined.length - slotChars + (c.locale === preferred ? 0.5 : 0)
      if (!best || score > best.score) {
        best = { match: { intent: c.intent, locale: c.locale, slots, pattern: c.pattern }, score }
      }
    }
    return best?.match ?? null
  }
}
