import type { Locale } from '@shared/i18n'
import { HOUR } from '../nlu/duration'
import type { Token } from '../nlu/text'
import { findWhen } from '../nlu/when'
import { formatDuration, formatWhen, messages } from './format'
import type { Intent, IntentContext, Reply, ScheduledItem, Skill } from './types'

const MAX_TIMER = 24 * HOUR

const say = messages({
  en: {
    timerSet: 'Timer set for {duration}.',
    timerSetLabel: '“{label}” timer set for {duration}.',
    timerTooLong: 'Timers can be up to 24 hours. For longer, try a reminder.',
    timerHowLong: 'For how long? Try “set a timer for 10 minutes”.',
    noTimers: 'You don’t have any timers running.',
    timerLeft: '{left} left on your {duration} timer.',
    timerLeftLabel: '{left} left on “{label}”.',
    timersHeader: 'You have {count} timers:',
    timerCancelled: 'Cancelled your {duration} timer.',
    timerCancelledLabel: 'Cancelled “{label}”.',
    timersCancelled: 'Cancelled {count} timers.',
    reminderSet: 'OK, I’ll remind you to {text} {when}.',
    reminderWhen: 'When should I remind you? Try “remind me to call mom tomorrow at 3pm”.',
    reminderWhat: 'What should I remind you about?',
    reminderPast: 'That time has already passed.',
    noReminders: 'You don’t have any reminders.',
    remindersHeader: 'Your reminders:',
    reminderLine: '• {text} — {when}',
    reminderCancelled: 'Cancelled the reminder to {text}.',
    remindersCancelled: 'Cancelled {count} reminders.'
  },
  'pt-BR': {
    timerSet: 'Timer de {duration} iniciado.',
    timerSetLabel: 'Timer “{label}” de {duration} iniciado.',
    timerTooLong: 'Timers podem ter até 24 horas. Para mais que isso, use um lembrete.',
    timerHowLong: 'De quanto tempo? Tente “coloca um timer de 10 minutos”.',
    noTimers: 'Você não tem nenhum timer ativo.',
    timerLeft: 'Faltam {left} no timer de {duration}.',
    timerLeftLabel: 'Faltam {left} em “{label}”.',
    timersHeader: 'Você tem {count} timers:',
    timerCancelled: 'Timer de {duration} cancelado.',
    timerCancelledLabel: 'Timer “{label}” cancelado.',
    timersCancelled: '{count} timers cancelados.',
    reminderSet: 'Beleza, vou te lembrar de {text} {when}.',
    reminderWhen: 'Quando eu devo te lembrar? Tente “me lembra de ligar pra mãe amanhã às 15h”.',
    reminderWhat: 'Do que eu devo te lembrar?',
    reminderPast: 'Esse horário já passou.',
    noReminders: 'Você não tem nenhum lembrete.',
    remindersHeader: 'Seus lembretes:',
    reminderLine: '• {text} — {when}',
    reminderCancelled: 'Lembrete de {text} cancelado.',
    remindersCancelled: '{count} lembretes cancelados.'
  }
})

/** Strings shown in the notification when an item fires. */
export const alertText = messages({
  en: { timerTitle: '⏰ Timer done', timerBody: 'Your {duration} timer is done.', reminderTitle: '🔔 Reminder', late: '(while the app was closed)' },
  'pt-BR': { timerTitle: '⏰ Timer finalizado', timerBody: 'Seu timer de {duration} terminou.', reminderTitle: '🔔 Lembrete', late: '(enquanto o app estava fechado)' }
})

export function describeAlert(item: ScheduledItem): { title: string; body: string } {
  const l = item.locale
  if (item.kind === 'timer') {
    const body = item.label || alertText(l, 'timerBody', { duration: formatDuration(item.durationMs ?? 0, l) })
    return { title: alertText(l, 'timerTitle'), body }
  }
  return { title: alertText(l, 'reminderTitle'), body: item.label }
}

// ---------- timers ----------

function timerLine(t: ScheduledItem, locale: Locale, now: Date): string {
  const left = formatDuration(t.dueAt - now.getTime(), locale)
  return t.label
    ? say(locale, 'timerLeftLabel', { left, label: t.label })
    : say(locale, 'timerLeft', { left, duration: formatDuration(t.durationMs ?? 0, locale) })
}

function setTimer({ locale, now, slots, services }: IntentContext): Reply {
  const ms = slots.duration.value ?? 0
  if (ms > MAX_TIMER) return { text: say(locale, 'timerTooLong') }
  const label = slots.label?.text.trim() ?? ''
  services.scheduler.add({ kind: 'timer', dueAt: now.getTime() + ms, label, locale, durationMs: ms })
  const duration = formatDuration(ms, locale)
  return { text: label ? say(locale, 'timerSetLabel', { label, duration }) : say(locale, 'timerSet', { duration }) }
}

// ---------- reminders ----------

const LEADING_CONNECTORS = new Set(['to', 'about', 'that', 'de', 'do', 'da', 'que', 'para', 'pra', 'sobre'])
const TRAILING_CONNECTORS = new Set(['on', 'at', 'in', 'e', 'and', 'para', 'pra'])

/** Rebuilds the reminder text from the tokens the date/time parser didn't use, keeping original spelling. */
function reminderText(tokens: Token[], used: Array<[number, number]>, source: string): string {
  let keep = tokens.filter((_, i) => !used.some(([s, e]) => i >= s && i < e))
  while (keep.length && LEADING_CONNECTORS.has(keep[0].norm)) keep = keep.slice(1)
  while (keep.length && TRAILING_CONNECTORS.has(keep[keep.length - 1].norm)) keep = keep.slice(0, -1)
  if (!keep.length) return ''
  const runs: string[] = []
  let runStart = keep[0]
  let prevIndex = tokens.indexOf(keep[0])
  for (let k = 1; k <= keep.length; k++) {
    const idx = k < keep.length ? tokens.indexOf(keep[k]) : -1
    if (idx !== prevIndex + 1) {
      runs.push(source.slice(runStart.start, tokens[prevIndex].end))
      if (k < keep.length) runStart = keep[k]
    }
    prevIndex = idx
  }
  return runs.join(' ').trim()
}

function createReminder({ locale, now, slots, services }: IntentContext): Reply {
  const body = slots.body
  const when = findWhen(body.tokens.map((t) => t.norm), locale, now)
  if (!when) return { text: say(locale, 'reminderWhen') }
  if (when.date.getTime() <= now.getTime()) return { text: say(locale, 'reminderPast') }
  const text = reminderText(body.tokens, when.spans, body.source)
  if (!text) return { text: say(locale, 'reminderWhat') }
  services.scheduler.add({ kind: 'reminder', dueAt: when.date.getTime(), label: text, locale, durationMs: null })
  return { text: say(locale, 'reminderSet', { text, when: formatWhen(when.date, now, locale) }) }
}

const intents: Intent[] = [
  {
    id: 'timer.set',
    slots: { duration: 'duration', label: 'text' },
    patterns: {
      en: [
        '(set|start|create|make|put on) [a|an|the] timer (for|of) {duration} [(called|named|labeled) {label}]',
        '(set|start|create|make) [a|an] {duration} timer [(called|named|labeled|for) {label}]',
        'timer (for|of) {duration} [(called|named|labeled) {label}]',
        '{duration} timer',
        'alert me in {duration}',
        'let me know in {duration}'
      ],
      'pt-BR': [
        '(coloca|colocar|coloque|poe|por|bota|botar|cria|criar|crie|inicia|iniciar|inicie|liga|ligar|ligue|ativa|ativar|ative|define|definir|defina|programa|programar|programe|marca|marcar|marque) [um|o] (timer|temporizador|cronometro) (de|para|pra|por|com) {duration} [(chamado|com nome|com o nome) {label}]',
        '(timer|temporizador) de {duration} [(chamado|com nome|com o nome) {label}]',
        '(me avisa|me avise|avisa|avise) (em|daqui a|daqui) {duration}'
      ]
    },
    handle: setTimer
  },
  {
    id: 'timer.askDuration',
    patterns: {
      en: ['(set|start|create|make) [a|an|the] timer', 'timer'],
      'pt-BR': ['(coloca|colocar|coloque|poe|bota|cria|criar|crie|inicia|iniciar|inicie|liga|ligar|ativa|ativar|define|programa|marca) [um|o] (timer|temporizador|cronometro)', 'timer', 'temporizador']
    },
    handle: ({ locale }) => ({ text: say(locale, 'timerHowLong') })
  },
  {
    id: 'timer.list',
    patterns: {
      en: [
        'how (much time|long) is left [on [the|my] timer]',
        'how much time [do i have] left',
        '[how much] time left [on [the|my] timer]',
        '(list|show) [me] [my|the] timers',
        'what timers (do i have|are running|are set)',
        'check [my|the] (timer|timers)'
      ],
      'pt-BR': [
        'quanto [tempo] (falta|resta|ainda falta) [no timer|pro timer|para o timer|no temporizador]',
        '(lista|listar|liste|mostra|mostrar|mostre) [os|meus] (timers|temporizadores)',
        'quais [sao] [os] (timers|temporizadores) [ativos]',
        '(ve|ver|veja|confere|conferir) [o|os] (timer|timers)'
      ]
    },
    handle: ({ locale, now, services }) => {
      const timers = services.scheduler.list('timer')
      if (!timers.length) return { text: say(locale, 'noTimers') }
      if (timers.length === 1) return { text: timerLine(timers[0], locale, now) }
      return {
        text: [say(locale, 'timersHeader', { count: timers.length }), ...timers.map((t) => '• ' + timerLine(t, locale, now))].join('\n')
      }
    }
  },
  {
    id: 'timer.cancel',
    patterns: {
      en: ['(cancel|stop|delete|remove|clear|kill|turn off) [the|my] timer'],
      'pt-BR': ['(cancela|cancelar|cancele|para|parar|pare|apaga|apagar|apague|desliga|desligar|desligue|remove|remover|remova|tira|tirar) [o|meu] (timer|temporizador)']
    },
    handle: ({ locale, services }) => {
      // with several timers, "cancel the timer" cancels the one ending soonest
      const [first] = services.scheduler.list('timer')
      if (!first) return { text: say(locale, 'noTimers') }
      services.scheduler.cancel([first.id])
      return {
        text: first.label
          ? say(locale, 'timerCancelledLabel', { label: first.label })
          : say(locale, 'timerCancelled', { duration: formatDuration(first.durationMs ?? 0, locale) })
      }
    }
  },
  {
    id: 'timer.cancelAll',
    patterns: {
      en: ['(cancel|stop|delete|remove|clear|kill|turn off) [all] [the|my] timers', '(cancel|stop|delete|remove|clear) all [of] [the|my] timers'],
      'pt-BR': ['(cancela|cancelar|cancele|para|parar|pare|apaga|apagar|apague|desliga|desligar|desligue|remove|remover|remova) [todos] [os|meus] (timers|temporizadores)']
    },
    handle: ({ locale, services }) => {
      const timers = services.scheduler.list('timer')
      if (!timers.length) return { text: say(locale, 'noTimers') }
      const count = services.scheduler.cancel(timers.map((t) => t.id))
      return { text: say(locale, 'timersCancelled', { count }) }
    }
  },
  {
    id: 'reminder.create',
    slots: { body: 'text' },
    patterns: {
      en: ['remind me {body}', '(set|create|add|make) [a] reminder {body}', 'reminder {body}', 'dont let me forget {body}'],
      'pt-BR': [
        '(me lembra|me lembre|me lembrar|lembra me|lembre me|lembra|lembre) {body}',
        '(cria|criar|crie|coloca|colocar|coloque|adiciona|adicionar|adicione|faz|faca|marca|marcar) [um] lembrete {body}',
        'lembrete {body}',
        'nao me deixa esquecer {body}'
      ]
    },
    handle: createReminder
  },
  {
    id: 'reminder.list',
    patterns: {
      en: ['(what are|list|show [me]) [all] my reminders', 'what reminders do i have', '[my] reminders', 'do i have any reminders'],
      'pt-BR': [
        '(quais sao|lista|listar|liste|mostra|mostrar|mostre) [os] [meus] lembretes',
        'quais lembretes [eu tenho]', '[meus] lembretes', 'tenho (algum lembrete|lembretes)'
      ]
    },
    handle: ({ locale, now, services }) => {
      const items = services.scheduler.list('reminder')
      if (!items.length) return { text: say(locale, 'noReminders') }
      const lines = items.map((r) => say(locale, 'reminderLine', { text: r.label, when: formatWhen(new Date(r.dueAt), now, locale) }))
      return { text: [say(locale, 'remindersHeader'), ...lines].join('\n') }
    }
  },
  {
    id: 'reminder.cancel',
    patterns: {
      en: ['(cancel|delete|remove|clear) [the|my] [last|next] reminder'],
      'pt-BR': ['(cancela|cancelar|cancele|apaga|apagar|apague|remove|remover|remova|exclui|excluir|exclua) [o|meu] [ultimo|proximo] lembrete']
    },
    handle: ({ locale, services }) => {
      const items = services.scheduler.list('reminder')
      if (!items.length) return { text: say(locale, 'noReminders') }
      // the most recently created one is the likeliest target
      const target = items.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
      services.scheduler.cancel([target.id])
      return { text: say(locale, 'reminderCancelled', { text: target.label }) }
    }
  },
  {
    id: 'reminder.cancelAll',
    patterns: {
      en: ['(cancel|delete|remove|clear) [all] [of] [the|my] reminders'],
      'pt-BR': ['(cancela|cancelar|cancele|apaga|apagar|apague|remove|remover|remova|exclui|excluir|exclua) [todos] [os|meus] lembretes']
    },
    handle: ({ locale, services }) => {
      const items = services.scheduler.list('reminder')
      if (!items.length) return { text: say(locale, 'noReminders') }
      const count = services.scheduler.cancel(items.map((r) => r.id))
      return { text: say(locale, 'remindersCancelled', { count }) }
    }
  }
]

export const timersSkill: Skill = { id: 'timers', intents }
