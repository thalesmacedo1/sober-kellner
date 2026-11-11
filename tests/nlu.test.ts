import { describe, expect, it } from 'vitest'
import type { Locale } from '@shared/i18n'
import { Nlu } from '../src/main/nlu/engine'
import { MINUTE, SECOND, HOUR } from '../src/main/nlu/duration'
import { skills } from '../src/main/skills'

const nlu = new Nlu(skills)

type Case = [text: string, intent: string | null, slots?: Record<string, string | number>]

/**
 * The phrase → intent table. When the assistant misunderstands something,
 * add the phrase here first, then fix the patterns.
 */
const EN: Case[] = [
  ['what time is it', 'system.time'],
  ['Hey Kellner, what time is it?', 'system.time'],
  ['what is the date today', 'system.date'],
  ['what day is it', 'system.date'],
  ['what can you do?', 'system.help'],
  ['hello', 'system.hello'],

  ['open calculator', 'pc.open', { target: 'calculator' }],
  ['Could you open Spotify please', 'pc.open', { target: 'Spotify' }],
  ['launch visual studio code', 'pc.open', { target: 'visual studio code' }],
  ['open my downloads folder', 'pc.open', { target: 'my downloads folder' }],
  ['set the volume to 30', 'pc.volume.set', { level: 30 }],
  ['volume 75%', 'pc.volume.set', { level: 75 }],
  ['set volume to fifty percent', 'pc.volume.set', { level: 50 }],
  ['turn it up', 'pc.volume.up'],
  ['turn the volume up by 20', 'pc.volume.up', { amount: 20 }],
  ['volume down', 'pc.volume.down'],
  ['lower the volume', 'pc.volume.down'],
  ["what's the volume", 'pc.volume.get'],
  ['mute', 'pc.volume.mute'],
  ['unmute the sound', 'pc.volume.unmute'],
  ['pause the music', 'pc.media.playPause'],
  ['play', 'pc.media.playPause'],
  ['next song', 'pc.media.next'],
  ['skip this track', 'pc.media.next'],
  ['previous track', 'pc.media.previous'],
  ['lock the computer', 'pc.lock'],
  ['take a screenshot', 'pc.screenshot'],

  ['set a timer for 10 minutes', 'timer.set', { duration: 10 * MINUTE }],
  ['start a timer for an hour and a half', 'timer.set', { duration: 90 * MINUTE }],
  ['set a 5 minute timer', 'timer.set', { duration: 5 * MINUTE }],
  ['timer for 1h30', 'timer.set', { duration: 90 * MINUTE }],
  ['set a timer for 2 minutes and 30 seconds', 'timer.set', { duration: 2 * MINUTE + 30 * SECOND }],
  ['set a timer for twenty five minutes called pasta', 'timer.set', { duration: 25 * MINUTE, label: 'pasta' }],
  ['set a timer', 'timer.askDuration'],
  ['how much time is left', 'timer.list'],
  ['how long is left on the timer', 'timer.list'],
  ['cancel the timer', 'timer.cancel'],
  ['stop the timer', 'timer.cancel'],
  ['cancel all timers', 'timer.cancelAll'],
  ['remind me to call mom tomorrow at 3pm', 'reminder.create', { body: 'to call mom tomorrow at 3pm' }],
  ['remind me in 20 minutes to check the oven', 'reminder.create'],
  ['what are my reminders', 'reminder.list'],
  ['cancel the reminder', 'reminder.cancel'],
  ['delete all my reminders', 'reminder.cancelAll'],

  ['make me a sandwich', null],
  ['blorp', null]
]

const PT: Case[] = [
  ['que horas são?', 'system.time'],
  ['Kellner, que horas são', 'system.time'],
  ['que dia é hoje', 'system.date'],
  ['o que você sabe fazer?', 'system.help'],
  ['bom dia', 'system.hello'],

  ['abre a calculadora', 'pc.open', { target: 'calculadora' }],
  ['abrir o Spotify', 'pc.open', { target: 'Spotify' }],
  ['pode abrir o bloco de notas por favor', 'pc.open', { target: 'bloco de notas' }],
  ['abre a pasta de downloads', 'pc.open', { target: 'pasta de downloads' }],
  ['coloca o volume em 30', 'pc.volume.set', { level: 30 }],
  ['volume 80', 'pc.volume.set', { level: 80 }],
  ['deixa o volume em cinquenta por cento', 'pc.volume.set', { level: 50 }],
  ['aumenta o volume', 'pc.volume.up'],
  ['sobe o som em 15', 'pc.volume.up', { amount: 15 }],
  ['abaixa o volume', 'pc.volume.down'],
  ['mais baixo', 'pc.volume.down'],
  ['qual é o volume', 'pc.volume.get'],
  ['silenciar', 'pc.volume.mute'],
  ['tira o som', 'pc.volume.mute'],
  ['liga o som', 'pc.volume.unmute'],
  ['pausa a música', 'pc.media.playPause'],
  ['continua', 'pc.media.playPause'],
  ['próxima música', 'pc.media.next'],
  ['pula essa música', 'pc.media.next'],
  ['música anterior', 'pc.media.previous'],
  ['bloqueia o computador', 'pc.lock'],
  ['trava a tela', 'pc.lock'],
  ['tira um print da tela', 'pc.screenshot'],

  ['coloca um timer de 10 minutos', 'timer.set', { duration: 10 * MINUTE }],
  ['timer de meia hora', 'timer.set', { duration: 30 * MINUTE }],
  ['cria um temporizador de uma hora e meia', 'timer.set', { duration: 90 * MINUTE }],
  ['coloca um timer de vinte e cinco minutos chamado macarrão', 'timer.set', { duration: 25 * MINUTE, label: 'macarrão' }],
  ['timer de 2 minutos e 30 segundos', 'timer.set', { duration: 2 * MINUTE + 30 * SECOND }],
  ['me avisa em 5 minutos', 'timer.set', { duration: 5 * MINUTE }],
  ['inicia um timer de 2 horas', 'timer.set', { duration: 2 * HOUR }],
  ['coloca um timer', 'timer.askDuration'],
  ['quanto tempo falta?', 'timer.list'],
  ['quanto falta no timer', 'timer.list'],
  ['cancela o timer', 'timer.cancel'],
  ['para o timer', 'timer.cancel'],
  ['cancela todos os timers', 'timer.cancelAll'],
  ['me lembra de ligar pra mãe amanhã às 15h', 'reminder.create', { body: 'de ligar pra mãe amanhã às 15h' }],
  ['lembre-me de tirar o lixo hoje à noite', 'reminder.create'],
  ['quais são os meus lembretes', 'reminder.list'],
  ['cancela o lembrete', 'reminder.cancel'],
  ['apaga todos os lembretes', 'reminder.cancelAll'],

  ['faz um sanduíche pra mim', null]
]

function check(locale: Locale, cases: Case[]): void {
  for (const [text, intent, slots] of cases) {
    it(`${JSON.stringify(text)} → ${intent ?? 'no match'}`, () => {
      const m = nlu.parse(text, locale)
      expect(m?.intent.id ?? null, `matched pattern: ${m?.pattern}`).toBe(intent)
      for (const [name, expected] of Object.entries(slots ?? {})) {
        const slot = m?.slots[name]
        expect(typeof expected === 'number' ? slot?.value : slot?.text, `slot ${name}`).toBe(expected)
      }
    })
  }
}

describe('NLU — English', () => check('en', EN))
describe('NLU — Português', () => check('pt-BR', PT))

describe('NLU — language detection', () => {
  it('matches Portuguese even when the UI is in English', () => {
    expect(nlu.parse('coloca um timer de 5 minutos', 'en')?.locale).toBe('pt-BR')
  })
  it('matches English even when the UI is in Portuguese', () => {
    expect(nlu.parse('set a timer for 5 minutes', 'pt-BR')?.locale).toBe('en')
  })
})
