import { describe, expect, it } from 'vitest'
import { Assistant } from '../src/main/assistant'
import { MINUTE } from '../src/main/nlu/duration'
import { matchApp, matchFolder } from '../src/main/skills/pc/apps'
import { skills } from '../src/main/skills'
import { FAKE_APPS, NOW, fakeServices } from './helpers'

function setup() {
  const fake = fakeServices()
  const assistant = new Assistant(skills, fake.services, () => new Date(NOW))
  // Object.assign keeps fake's `volume` getter live (a spread would snapshot it)
  return Object.assign(fake, { ask: (text: string) => assistant.handle(text, 'pt-BR') })
}

describe('timers', () => {
  it('sets, lists and cancels a timer (pt-BR)', async () => {
    const s = setup()
    expect((await s.ask('coloca um timer de 10 minutos')).text).toBe('Timer de 10 minutos iniciado.')
    expect(s.store.items).toHaveLength(1)
    expect(s.store.items[0]).toMatchObject({ kind: 'timer', dueAt: NOW.getTime() + 10 * MINUTE, locale: 'pt-BR' })
    expect((await s.ask('quanto tempo falta')).text).toBe('Faltam 10 minutos no timer de 10 minutos.')
    expect((await s.ask('cancela o timer')).text).toBe('Timer de 10 minutos cancelado.')
    expect(s.store.items).toHaveLength(0)
  })

  it('replies in English when asked in English', async () => {
    const s = setup()
    expect((await s.ask('set a timer for 1 hour and 30 minutes called bread')).text).toBe('“bread” timer set for 1 hour and 30 minutes.')
  })

  it('fires when due', async () => {
    const s = setup()
    await s.ask('set a timer for 5 minutes')
    s.scheduler.tick()
    expect(s.fired).toHaveLength(0)
    s.advance(5 * MINUTE)
    s.scheduler.tick()
    expect(s.fired).toHaveLength(1)
    expect(s.fired[0].late).toBe(false)
    expect(s.store.items).toHaveLength(0)
  })

  it('rejects timers over 24h', async () => {
    const s = setup()
    expect((await s.ask('set a timer for 30 hours')).text).toMatch(/up to 24 hours/)
  })
})

describe('reminders', () => {
  it('extracts text and time (pt-BR)', async () => {
    const s = setup()
    const r = await s.ask('me lembra de ligar pra mãe amanhã às 15h')
    expect(r.text).toBe('Beleza, vou te lembrar de ligar pra mãe amanhã às 15:00.')
    expect(s.store.items[0]).toMatchObject({ kind: 'reminder', label: 'ligar pra mãe', dueAt: new Date(2026, 10, 12, 15, 0).getTime() })
  })

  it('handles the time before the text (en)', async () => {
    const s = setup()
    const r = await s.ask('remind me in 20 minutes to check the oven')
    expect(r.text).toBe('OK, I’ll remind you to check the oven today at 10:20 AM.')
  })

  it('handles the time in the middle (en)', async () => {
    const s = setup()
    await s.ask('remind me tomorrow at 9am to send the report')
    expect(s.store.items[0].label).toBe('send the report')
  })

  it('asks when no time is given', async () => {
    const s = setup()
    expect((await s.ask('me lembra de comprar pão')).text).toMatch(/Quando eu devo te lembrar/)
    expect(s.store.items).toHaveLength(0)
  })

  it('lists and cancels', async () => {
    const s = setup()
    await s.ask('me lembra de comprar pão amanhã de manhã')
    await s.ask('me lembra de pagar a conta sexta às 10h')
    const list = (await s.ask('quais são os meus lembretes')).text
    expect(list).toContain('comprar pão — amanhã às 09:00')
    expect(list).toContain('pagar a conta — sexta-feira às 10:00')
    expect((await s.ask('apaga todos os lembretes')).text).toBe('2 lembretes cancelados.')
  })
})

describe('pc control', () => {
  it('opens apps by Portuguese name', async () => {
    const s = setup()
    const r = await s.ask('abre a calculadora')
    expect(s.calls).toContain('launch:Calculadora')
    expect(r.dismiss).toBe(true)
  })

  it('opens apps by English synonym on a Portuguese Windows', async () => {
    const s = setup()
    await s.ask('open notepad')
    expect(s.calls).toContain('launch:Bloco de Notas')
  })

  it('opens known folders', async () => {
    const s = setup()
    await s.ask('abre a pasta de downloads')
    expect(s.calls).toContain('openFolder:downloads')
  })

  it('says when an app is not found', async () => {
    const s = setup()
    expect((await s.ask('open photoshop')).text).toBe('I couldn’t find an app called “photoshop”.')
  })

  it('sets and steps the volume', async () => {
    const s = setup()
    await s.ask('volume 30')
    expect(s.volume.level).toBe(30)
    await s.ask('aumenta o volume')
    expect(s.volume.level).toBe(40)
    await s.ask('turn it down by 25')
    expect(s.volume.level).toBe(15)
  })

  it('mutes and sends media keys', async () => {
    const s = setup()
    await s.ask('silenciar')
    expect(s.volume.muted).toBe(true)
    await s.ask('próxima música')
    expect(s.calls).toContain('media:next')
  })
})

describe('matchApp / matchFolder', () => {
  it.each([
    ['chrome', 'Google Chrome'],
    ['vscode', 'Visual Studio Code'],
    ['visual studio', 'Visual Studio Code'],
    ['settings', 'Configurações'],
    ['configuracoes', 'Configurações'],
    ['word', 'Microsoft Word'],
    ['spotfy', 'Spotify'] // typo / STT error
  ])('%s → %s', (q, name) => expect(matchApp(q, FAKE_APPS)?.name).toBe(name))

  it('skips uninstallers and help entries', () => {
    expect(matchApp('7-zip', FAKE_APPS)).toBeNull()
  })

  it.each([
    ['downloads', 'downloads'],
    ['my documents', 'documents'],
    ['pasta de músicas', 'music'],
    ['música', null], // ambiguous without "pasta" → treated as an app
    ['área de trabalho', 'desktop']
  ])('%s → %s', (q, f) => expect(matchFolder(q)).toBe(f))
})

describe('fallbacks', () => {
  it('answers unknown requests in the UI language', async () => {
    const s = setup()
    const r = await s.ask('faz um sanduíche')
    expect(r.kind).toBe('unknown')
    expect(r.text).toMatch(/não entendi/)
  })
})
