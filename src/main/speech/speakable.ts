import type { Locale } from '@shared/i18n'

/**
 * Rewrites an on-screen reply into text that reads well aloud:
 * bullet lists become sentences, quotes and dashes become pauses,
 * and clock times are said the way people say them ("15:30" → "15 e 30").
 */
export function toSpeakable(text: string, locale: Locale): string {
  const sentences = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => (/[.!?:…]$/.test(line) ? line : line + '.'))

  return sentences
    .join(' ')
    .replace(/[“”"«»]/g, '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(locale === 'pt-BR' ? /\b(\d{1,2}):(\d{2})\b/g : /\b(\d{1,2}):(\d{2})(?=\s*[AP]M\b)/gi, (_, h: string, m: string) =>
      locale === 'pt-BR' ? sayTimePt(Number(h), Number(m)) : Number(m) === 0 ? String(Number(h)) : `${Number(h)}:${m}`
    )
    // "às 1 hora" → "à 1 hora", "às meio-dia" → "ao meio-dia"
    // (\b doesn't treat "à" as a word character, hence the lookbehind)
    .replace(/(?<=^|\s)às (1 hora|1 e |meia-noite)/g, 'à $1')
    .replace(/(?<=^|\s)às meio-dia/g, 'ao meio-dia')
    .replace(/[⏰🔔✓✔]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sayTimePt(h: number, m: number): string {
  const hour = h === 0 ? 'meia-noite' : h === 12 ? 'meio-dia' : `${h} ${h === 1 ? 'hora' : 'horas'}`
  if (m === 0) return hour
  return h === 0 || h === 12 ? `${hour} e ${m}` : `${h} e ${m === 30 ? 'meia' : m}`
}
