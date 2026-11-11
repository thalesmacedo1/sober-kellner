import { tokenize } from './text'

/**
 * Compiles a phrase template to a RegExp over normalized text (" word word ... ").
 *
 *   (a|b c)   one of the alternatives
 *   [a|b]     optional
 *   {name}    a slot: one or more words, captured as a named group
 *
 * e.g. "(set|start) [a] timer (for|of) {duration}"
 * Words are normalized like user input (lowercase, no accents), so "três" == "tres".
 */
export function compilePattern(pattern: string): RegExp {
  const lexemes = pattern.match(/\{\w+\}|[()[\]|]|[^\s()[\]|{}]+/g) ?? []
  let pos = 0

  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  function parseSequence(stops: string[]): string {
    let out = ''
    while (pos < lexemes.length && !stops.includes(lexemes[pos])) {
      const lx = lexemes[pos++]
      if (lx === '(' || lx === '[') {
        const closer = lx === '(' ? ')' : ']'
        const alts = parseAlternatives(closer)
        out += lx === '(' ? `(?:${alts})` : `(?:${alts})?`
      } else if (lx.startsWith('{')) {
        out += `(?: (?<${lx.slice(1, -1)}>.+?))`
      } else if (lx === ')' || lx === ']' || lx === '|') {
        throw new Error(`Unexpected "${lx}" in pattern: ${pattern}`)
      } else {
        out += tokenize(lx)
          .map((t) => ' ' + escape(t.norm))
          .join('')
      }
    }
    return out
  }

  function parseAlternatives(closer: string): string {
    const alts: string[] = []
    for (;;) {
      alts.push(parseSequence(['|', closer]))
      const lx = lexemes[pos++]
      if (lx === '|') continue
      if (lx === closer) return alts.join('|')
      throw new Error(`Missing "${closer}" in pattern: ${pattern}`)
    }
  }

  const body = parseSequence([])
  if (pos < lexemes.length) throw new Error(`Unbalanced pattern: ${pattern}`)
  return new RegExp(`^${body} $`, 'd')
}
