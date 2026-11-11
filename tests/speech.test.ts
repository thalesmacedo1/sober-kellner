import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toSpeakable } from '../src/main/speech/speakable'
import { Tts } from '../src/main/speech/tts'

describe('toSpeakable', () => {
  it.each([
    ['Beleza, vou te lembrar de ligar pra mãe amanhã às 15:00.', 'Beleza, vou te lembrar de ligar pra mãe amanhã às 15 horas.'],
    ['Agora são 09:30.', 'Agora são 9 e meia.'],
    ['Lembrete às 14:05.', 'Lembrete às 14 e 5.'],
    ['amanhã às 01:00', 'amanhã à 1 hora.'],
    ['hoje às 12:00', 'hoje ao meio-dia.'],
    ['hoje às 00:15', 'hoje à meia-noite e 15.']
  ])('pt-BR: %s', (input, out) => expect(toSpeakable(input, 'pt-BR')).toBe(out))

  it.each([
    ['OK, I’ll remind you to check the oven today at 10:00 AM.', 'OK, I’ll remind you to check the oven today at 10 AM.'],
    ['It’s 3:45 PM.', 'It’s 3:45 PM.'],
    ['“bread” timer set for 1 hour.', 'bread timer set for 1 hour.']
  ])('en: %s', (input, out) => expect(toSpeakable(input, 'en')).toBe(out))

  it('turns bullet lists into sentences', () => {
    expect(toSpeakable('Seus lembretes:\n• comprar pão — amanhã às 09:00\n• pagar a conta — sexta-feira às 10:00', 'pt-BR')).toBe(
      'Seus lembretes: comprar pão, amanhã às 9 horas. pagar a conta, sexta-feira às 10 horas.'
    )
  })

  it('drops emoji', () => {
    expect(toSpeakable('🔔 Lembrete: comprar pão', 'pt-BR')).toBe('Lembrete: comprar pão.')
  })
})

// Runs against the real Piper binary when `npm run models` has been run; skipped otherwise.
const modelsDir = join(__dirname, '..', 'models')
const tts = new Tts(modelsDir, mkdtempSync(join(tmpdir(), 'kellner-tts-test-')), { play: () => {}, stop: () => {} })

describe.skipIf(!existsSync(join(modelsDir, 'piper')))('Piper (real models)', () => {
  it('speaks both languages, newest request wins', async () => {
    const played: Uint8Array[] = []
    const t = new Tts(modelsDir, mkdtempSync(join(tmpdir(), 'kellner-tts-test-')), { play: (w) => played.push(w), stop: () => {} })
    try {
      const first = t.speak('This one gets interrupted by the next request.', 'en')
      await t.speak('Timer de 10 minutos iniciado.', 'pt-BR')
      await first
      expect(played).toHaveLength(1)
      expect(Buffer.from(played[0].subarray(0, 4)).toString('ascii')).toBe('RIFF')
      expect(played[0].byteLength).toBeGreaterThan(20_000)
    } finally {
      t.dispose()
    }
  }, 30_000)

  it('reports availability', () => expect(tts.available()).toBe(true))
})
