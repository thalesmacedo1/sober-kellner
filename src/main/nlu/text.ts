/** A word from the user's input: normalized form + its position in the original text. */
export interface Token {
  /** lowercase, accents removed: "Amanhã" → "amanha" */
  norm: string
  start: number
  end: number
}

const COMBINING_MARKS = /[̀-ͯ]/g

function normalizeChar(ch: string): string {
  return ch.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/**
 * Splits text into word tokens. Keeps "3:30", "1.5", "1,5" (→ "1.5") and "50%" together,
 * drops apostrophes ("what's" → "whats") and treats every other symbol as a separator.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let current = ''
  let start = -1

  const flush = (end: number): void => {
    if (current) tokens.push({ norm: current, start, end })
    current = ''
    start = -1
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const n = normalizeChar(ch)
    if (n === '') continue // stray combining mark
    if (/^[a-z0-9]+$/.test(n)) {
      if (!current) start = i
      current += n
      continue
    }
    const nextIsDigit = /\d/.test(input[i + 1] ?? '')
    if ((ch === ':' || ch === '.' || ch === ',') && /\d$/.test(current) && nextIsDigit) {
      current += ch === ',' ? '.' : ch
      continue
    }
    if (ch === '%' && /\d$/.test(current)) {
      current += '%'
      continue
    }
    if ((ch === "'" || ch === '’') && current) continue
    flush(i)
  }
  flush(input.length)
  return tokens
}

export function normalizeText(input: string): string {
  return tokenize(input)
    .map((t) => t.norm)
    .join(' ')
}

/** True when `tokens` starting at `i` equal `words`. */
export function startsWithAt(tokens: readonly string[], i: number, words: readonly string[]): boolean {
  return words.every((w, k) => tokens[i + k] === w)
}

const LEADING_FILLERS = [
  ['hey', 'kellner'], ['ok', 'kellner'], ['oi', 'kellner'], ['ola', 'kellner'], ['kellner'],
  ['hey'], ['ok'], ['okay'], ['please'], ['por', 'favor'],
  ['can', 'you'], ['could', 'you'], ['would', 'you'], ['will', 'you'],
  ['voce', 'pode'], ['voce', 'poderia'], ['voce', 'consegue'], ['pode'], ['poderia'], ['consegue']
]
const TRAILING_FILLERS = [
  ['please'], ['por', 'favor'], ['pra', 'mim'], ['para', 'mim'], ['for', 'me'], ['kellner'],
  ['obrigado'], ['obrigada'], ['thanks'], ['thank', 'you'], ['now'], ['agora']
]

/** Removes wake words and politeness around a command ("hey kellner, could you … please"). */
export function stripFillers(tokens: Token[]): Token[] {
  let out = tokens
  let changed = true
  while (changed) {
    changed = false
    const norms = out.map((t) => t.norm)
    for (const f of LEADING_FILLERS) {
      if (out.length > f.length && startsWithAt(norms, 0, f)) {
        out = out.slice(f.length)
        changed = true
        break
      }
    }
    if (changed) continue
    for (const f of TRAILING_FILLERS) {
      if (out.length > f.length && startsWithAt(norms, norms.length - f.length, f)) {
        out = out.slice(0, out.length - f.length)
        changed = true
        break
      }
    }
  }
  return out
}
