import { formatTime, messages } from './format'
import type { Skill } from './types'

const say = messages({
  en: {
    time: 'It’s {time}.',
    date: 'Today is {date}.',
    hello: 'Hi! How can I help?',
    help:
      'Here’s what I can do so far:\n' +
      '• Open apps and folders — “open calculator”, “open downloads”\n' +
      '• Volume and media — “volume 30”, “mute”, “next song”, “pause”\n' +
      '• Lock the PC or take a screenshot\n' +
      '• Timers — “set a timer for 10 minutes”, “how much time is left?”\n' +
      '• Reminders — “remind me to call mom tomorrow at 3pm”\n' +
      '• Time and date — “what time is it?”'
  },
  'pt-BR': {
    time: 'Agora são {time}.',
    date: 'Hoje é {date}.',
    hello: 'Oi! Como posso ajudar?',
    help:
      'Por enquanto eu sei:\n' +
      '• Abrir apps e pastas — “abre a calculadora”, “abre os downloads”\n' +
      '• Volume e mídia — “volume 30”, “silenciar”, “próxima música”, “pausa”\n' +
      '• Bloquear o PC ou tirar print da tela\n' +
      '• Timers — “coloca um timer de 10 minutos”, “quanto tempo falta?”\n' +
      '• Lembretes — “me lembra de ligar pra mãe amanhã às 15h”\n' +
      '• Hora e data — “que horas são?”'
  }
})

export const systemSkill: Skill = {
  id: 'system',
  intents: [
    {
      id: 'system.time',
      patterns: {
        en: ['what time is it', '(whats|what is) the time', 'tell me the time', '[the] time', 'what time [is it] [right] now'],
        'pt-BR': ['que (horas|hora) (sao|e)', '(me diz|me diga|diz|diga|fala) (as horas|que horas sao)', 'horas', 'que horas']
      },
      handle: ({ locale, now }) => ({ text: say(locale, 'time', { time: formatTime(now, locale) }) })
    },
    {
      id: 'system.date',
      patterns: {
        en: [
          '(whats|what is) [the] [date] today',
          '(whats|what is) (the|todays) date [today]',
          'what day is (it|today) [today]',
          '[todays] date'
        ],
        'pt-BR': [
          '(que|qual) dia (e|eh) hoje',
          '(que|qual) dia (e|eh)',
          'qual [e] a data [de hoje]',
          'que data (e|eh) hoje',
          'data de hoje'
        ]
      },
      handle: ({ locale, now }) => ({
        text: say(locale, 'date', {
          date: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
        })
      })
    },
    {
      id: 'system.hello',
      patterns: {
        en: ['(hi|hello|hey) [there]', 'good (morning|afternoon|evening)'],
        'pt-BR': ['(oi|ola|e ai)', '(bom dia|boa tarde|boa noite)']
      },
      handle: ({ locale }) => ({ text: say(locale, 'hello') })
    },
    {
      id: 'system.help',
      patterns: {
        en: ['help', 'what can you do', 'what do you do', 'what are you able to do'],
        'pt-BR': ['ajuda', 'socorro', 'o que (voce|vc) (sabe fazer|faz|pode fazer|consegue fazer)', 'quais sao [os] [seus] comandos']
      },
      handle: ({ locale }) => ({ text: say(locale, 'help') })
    }
  ]
}
