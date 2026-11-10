import type { Translate } from '@shared/i18n'
import type { AssistantReply } from '@shared/ipc'

/**
 * Entry point for every request, typed or (later) spoken.
 * Phase 0: echo only. Phase 1 replaces this with NLU (NLP.js + chrono-node) → skill router.
 */
export async function handleQuery(text: string, t: Translate): Promise<AssistantReply> {
  return { text: t('reply.echo', { text: text.trim() }) }
}
