import { createTranslator, type Locale } from '@shared/i18n'
import type { AssistantReply } from '@shared/ipc'
import { Nlu } from './nlu/engine'
import type { Services, Skill } from './skills/types'

/**
 * Entry point for every request, typed or (later) spoken:
 * text → NLU (phrase templates, both languages) → skill handler → reply.
 * Replies come back in the language the user used, not necessarily the UI language.
 */
export class Assistant {
  private readonly nlu: Nlu

  constructor(
    skills: Skill[],
    private readonly services: Services,
    private readonly now: () => Date = () => new Date()
  ) {
    this.nlu = new Nlu(skills)
  }

  async handle(text: string, uiLocale: Locale): Promise<AssistantReply> {
    const match = this.nlu.parse(text, uiLocale)
    if (!match) return { text: createTranslator(uiLocale)('reply.unknown'), kind: 'unknown' }

    try {
      const reply = await match.intent.handle({
        locale: match.locale,
        now: this.now(),
        slots: match.slots,
        services: this.services
      })
      return { ...reply, kind: 'ok', intent: match.intent.id }
    } catch (err) {
      console.error(`[assistant] ${match.intent.id} failed`, err)
      return { text: createTranslator(match.locale)('reply.error'), kind: 'error', intent: match.intent.id }
    }
  }
}
