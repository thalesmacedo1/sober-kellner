import { messages } from '../format'
import type { Intent, IntentContext, Reply, Skill } from '../types'
import { cleanAppQuery, matchApp, matchFolder } from './apps'

const VOLUME_STEP = 10

const say = messages({
  en: {
    opening: 'Opening {name}.',
    openingFolder: 'Opening your {name} folder.',
    noApp: 'I couldn’t find an app called “{name}”.',
    volumeSet: 'Volume set to {level}%.',
    volumeIs: 'The volume is at {level}%{muted}.',
    mutedSuffix: ' (muted)',
    muted: 'Muted.',
    unmuted: 'Sound is back on — volume at {level}%.',
    playPause: 'Done.',
    next: 'Skipping to the next track.',
    previous: 'Going back to the previous track.',
    locking: 'Locking the computer.',
    screenshot: 'Screenshot saved to {path}.'
  },
  'pt-BR': {
    opening: 'Abrindo {name}.',
    openingFolder: 'Abrindo a pasta {name}.',
    noApp: 'Não encontrei nenhum app chamado “{name}”.',
    volumeSet: 'Volume em {level}%.',
    volumeIs: 'O volume está em {level}%{muted}.',
    mutedSuffix: ' (no mudo)',
    muted: 'Som desligado.',
    unmuted: 'Som ligado — volume em {level}%.',
    playPause: 'Feito.',
    next: 'Pulando para a próxima faixa.',
    previous: 'Voltando para a faixa anterior.',
    locking: 'Bloqueando o computador.',
    screenshot: 'Print salvo em {path}.'
  }
})

const FOLDER_NAMES = {
  en: { home: 'home', desktop: 'Desktop', documents: 'Documents', downloads: 'Downloads', music: 'Music', pictures: 'Pictures', videos: 'Videos' },
  'pt-BR': { home: 'pessoal', desktop: 'Área de Trabalho', documents: 'Documentos', downloads: 'Downloads', music: 'Músicas', pictures: 'Imagens', videos: 'Vídeos' }
} as const

async function open({ locale, slots, services }: IntentContext): Promise<Reply> {
  const spoken = slots.target.text
  const folder = matchFolder(spoken)
  if (folder) {
    await services.pc.openFolder(folder)
    return { text: say(locale, 'openingFolder', { name: FOLDER_NAMES[locale][folder] }), dismiss: true }
  }
  const query = cleanAppQuery(spoken)
  const app = matchApp(query, await services.pc.listApps())
  if (!app) return { text: say(locale, 'noApp', { name: query }) }
  await services.pc.launchApp(app)
  return { text: say(locale, 'opening', { name: app.name }), dismiss: true }
}

async function stepVolume(ctx: IntentContext, direction: 1 | -1): Promise<Reply> {
  const { level } = await ctx.services.pc.getVolume()
  const step = ctx.slots.amount?.value ?? VOLUME_STEP
  const next = await ctx.services.pc.setVolume(Math.max(0, Math.min(100, level + direction * step)))
  if (next.muted && direction > 0) await ctx.services.pc.setMuted(false)
  return { text: say(ctx.locale, 'volumeSet', { level: next.level }) }
}

const intents: Intent[] = [
  {
    id: 'pc.open',
    patterns: {
      en: ['(open|launch|start|run) {target}', 'go to [my] {target} folder', 'show [me] [my] {target} folder'],
      'pt-BR': [
        '(abre|abrir|abra|abri|inicia|iniciar|inicie|executa|executar|execute|roda|rodar|rode) [o|a|os|as|meu|minha|meus|minhas] {target}',
        '(vai|va|ir) (para|pra) [a] {target}',
        '(mostra|mostre|mostrar) [a|o] {target}'
      ]
    },
    handle: open
  },
  {
    id: 'pc.volume.set',
    slots: { level: 'percent' },
    patterns: {
      en: ['(set|change|put|turn) [the] volume (to|at) {level}', 'volume [to|at] {level}'],
      'pt-BR': [
        '(coloca|colocar|coloque|poe|por|bota|botar|ajusta|ajustar|ajuste|muda|mudar|mude|deixa|deixar|deixe) [o] volume (em|no|para|pra|a|no maximo em) {level}',
        'volume (em|no|para|pra|a) {level}',
        'volume {level}'
      ]
    },
    handle: async ({ locale, slots, services }) => {
      const level = slots.level.value ?? 50
      await services.pc.setMuted(false)
      const state = await services.pc.setVolume(level)
      return { text: say(locale, 'volumeSet', { level: state.level }) }
    }
  },
  {
    id: 'pc.volume.up',
    slots: { amount: 'percent' },
    patterns: {
      en: [
        '(turn|crank) (it|the volume|volume|the sound|the music) up [by {amount}]',
        '(turn|crank) up (the volume|volume|the sound|the music) [by {amount}]',
        '(increase|raise) [the] volume [by {amount}]',
        'volume up [by {amount}]',
        'louder'
      ],
      'pt-BR': [
        '(aumenta|aumentar|aumente|sobe|subir|suba) [o] (volume|som) [em {amount}]',
        'volume (mais alto|pra cima)',
        'mais alto'
      ]
    },
    handle: (ctx) => stepVolume(ctx, 1)
  },
  {
    id: 'pc.volume.down',
    slots: { amount: 'percent' },
    patterns: {
      en: [
        '(turn) (it|the volume|volume|the sound|the music) down [by {amount}]',
        '(turn) down (the volume|volume|the sound|the music) [by {amount}]',
        '(decrease|lower|reduce) [the] volume [by {amount}]',
        'volume down [by {amount}]',
        'quieter'
      ],
      'pt-BR': [
        '(diminui|diminuir|diminua|abaixa|abaixar|abaixe|baixa|baixar|baixe|reduz|reduzir|reduza) [o] (volume|som) [em {amount}]',
        'volume (mais baixo|pra baixo)',
        'mais baixo'
      ]
    },
    handle: (ctx) => stepVolume(ctx, -1)
  },
  {
    id: 'pc.volume.get',
    patterns: {
      en: ['(whats|what is) the volume [at|level]', 'how loud is it', 'what volume is it [at]'],
      'pt-BR': ['(qual|quanto) [e|esta] [o] volume', 'em quanto (esta|ta) o volume', 'qual o volume [atual]']
    },
    handle: async ({ locale, services }) => {
      const { level, muted } = await services.pc.getVolume()
      return { text: say(locale, 'volumeIs', { level, muted: muted ? say(locale, 'mutedSuffix') : '' }) }
    }
  },
  {
    id: 'pc.volume.mute',
    patterns: {
      en: ['mute [it|the volume|the sound|the audio|the computer]', 'silence', 'turn off the sound'],
      'pt-BR': [
        '(muta|mutar|mute|silencia|silenciar|silencie) [o] [som|audio|volume|computador]',
        '(tira|tirar|tire|desliga|desligar|desligue|corta|cortar) o (som|audio)',
        'modo silencioso', 'mudo', 'fica (quieto|quieta|em silencio)'
      ]
    },
    handle: async ({ locale, services }) => {
      await services.pc.setMuted(true)
      return { text: say(locale, 'muted') }
    }
  },
  {
    id: 'pc.volume.unmute',
    patterns: {
      en: ['unmute [it|the volume|the sound|the audio|the computer]', 'turn (on|back on) the sound', 'turn the sound (on|back on)'],
      'pt-BR': [
        '(desmuta|desmutar|desmute|dessilencia|dessilenciar) [o] [som|audio|volume|computador]',
        '(ativa|ativar|ative|liga|ligar|ligue|volta|voltar|devolve) o (som|audio)',
        'tira [do] mudo'
      ]
    },
    handle: async ({ locale, services }) => {
      const state = await services.pc.setMuted(false)
      return { text: say(locale, 'unmuted', { level: state.level }) }
    }
  },
  {
    id: 'pc.media.playPause',
    patterns: {
      en: ['(pause|play|resume|unpause|stop) [the] [music|song|track|video|media|playback]', 'play pause'],
      'pt-BR': [
        '(pausa|pausar|pause|despausa|despausar|continua|continuar|continue|retoma|retomar|play) [a|o] [musica|video|som|faixa]',
        '(para|parar|pare|toca|tocar|toque|solta|soltar) [a|o] (musica|video|som|faixa)'
      ]
    },
    handle: async ({ locale, services }) => {
      await services.pc.mediaKey('playPause')
      return { text: say(locale, 'playPause'), dismiss: true }
    }
  },
  {
    id: 'pc.media.next',
    patterns: {
      en: ['next [song|track|one]', 'skip [this|the] [song|track|one]', '(play|go to) the next (song|track|one)'],
      'pt-BR': [
        '(proxima|proximo) [musica|faixa|video]',
        '(pula|pular|pule|passa|passar|passe|avanca|avancar|avance) [essa|esta|a|o] [musica|faixa|video]'
      ]
    },
    handle: async ({ locale, services }) => {
      await services.pc.mediaKey('next')
      return { text: say(locale, 'next'), dismiss: true }
    }
  },
  {
    id: 'pc.media.previous',
    patterns: {
      en: ['previous [song|track|one]', '(play|go back to) the (previous|last) (song|track|one)', 'go back [a song|a track]'],
      'pt-BR': [
        '(musica|faixa) anterior', 'anterior',
        '(volta|voltar|volte) [a|uma|pra] [musica|faixa] [anterior]'
      ]
    },
    handle: async ({ locale, services }) => {
      await services.pc.mediaKey('previous')
      return { text: say(locale, 'previous'), dismiss: true }
    }
  },
  {
    id: 'pc.lock',
    patterns: {
      en: ['lock [the|my] [computer|pc|screen|laptop|workstation]'],
      'pt-BR': ['(bloqueia|bloquear|bloqueie|trava|travar|trave) [o|a] [computador|pc|tela|notebook]']
    },
    handle: async ({ locale, services }) => {
      setTimeout(() => void services.pc.lock(), 700) // let the reply render first
      return { text: say(locale, 'locking'), dismiss: true }
    }
  },
  {
    id: 'pc.screenshot',
    patterns: {
      en: ['[take|grab|capture] [a] screenshot', '(take|grab) a screen (shot|capture)', 'capture [the] screen', 'print [the] screen'],
      'pt-BR': [
        '(tira|tirar|tire|faz|fazer|faca|bate|bater) [um] (print|screenshot|captura) [da tela]',
        '(captura|capturar|capture|printa|printar|printe) [a] tela',
        'print [da tela]', 'screenshot'
      ]
    },
    handle: async ({ locale, services }) => {
      const path = await services.pc.screenshot()
      return { text: say(locale, 'screenshot', { path }) }
    }
  }
]

export const pcSkill: Skill = { id: 'pc', intents }
