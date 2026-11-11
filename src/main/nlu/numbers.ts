import type { Locale } from '@shared/i18n'

export interface Parsed<T> {
  value: T
  /** index of the first token after the parsed span */
  next: number
}

type Dict = Record<string, number>

const EN_UNITS: Dict = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19
}
const EN_TENS: Dict = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

const PT_UNITS: Dict = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19
}
const PT_TENS: Dict = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 }

const has = (d: Dict, w: string | undefined): w is string => w !== undefined && Object.hasOwn(d, w)

/** Parses a number written as digits ("25", "1.5") or words (0–100) at position `i`. */
export function parseNumber(tokens: readonly string[], i: number, locale: Locale): Parsed<number> | null {
  const w = tokens[i]
  if (w === undefined) return null
  if (/^\d+(\.\d+)?$/.test(w)) return { value: Number(w), next: i + 1 }

  const units = locale === 'pt-BR' ? PT_UNITS : EN_UNITS
  const tens = locale === 'pt-BR' ? PT_TENS : EN_TENS

  if (has(units, w)) return { value: units[w], next: i + 1 }
  if (has(tens, w)) {
    // "twenty five", "vinte e cinco"
    const connector = tokens[i + 1] === 'e' || tokens[i + 1] === 'and'
    const u = tokens[connector ? i + 2 : i + 1]
    if (has(units, u) && units[u] >= 1 && units[u] <= 9) {
      return { value: tens[w] + units[u], next: connector ? i + 3 : i + 2 }
    }
    return { value: tens[w], next: i + 1 }
  }
  if (w === 'cem' || w === 'hundred') return { value: 100, next: i + 1 }
  if ((w === 'one' || w === 'a') && tokens[i + 1] === 'hundred') return { value: 100, next: i + 2 }
  return null
}

/** The whole token list must be one number. */
export function parseNumberExact(tokens: readonly string[], locale: Locale): number | null {
  const r = parseNumber(tokens, 0, locale)
  return r && r.next === tokens.length ? r.value : null
}

/** "50", "50%", "50 percent", "cinquenta por cento" → 50 (0–100 only). */
export function parsePercent(tokens: readonly string[], locale: Locale): number | null {
  let list = [...tokens]
  const last = list.at(-1) ?? ''
  if (/^\d+%$/.test(last)) list[list.length - 1] = last.slice(0, -1)
  if (list.at(-1) === 'percent' || list.at(-1) === 'porcento' || list.at(-1) === '%') list = list.slice(0, -1)
  else if (list.at(-2) === 'por' && list.at(-1) === 'cento') list = list.slice(0, -2)
  const n = parseNumberExact(list, locale)
  return n !== null && n >= 0 && n <= 100 ? Math.round(n) : null
}
