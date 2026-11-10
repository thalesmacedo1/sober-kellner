import { useEffect, useMemo, useState } from 'react'
import { createTranslator, type Translate } from '@shared/i18n'
import type { AppState } from '@shared/ipc'

export function useAppState(): { state: AppState | null; t: Translate } {
  const [state, setState] = useState<AppState | null>(null)

  useEffect(() => {
    void window.kellner.getState().then(setState)
    return window.kellner.onStateChanged(setState)
  }, [])

  useEffect(() => {
    if (state) document.documentElement.lang = state.locale
  }, [state?.locale])

  const t = useMemo(() => createTranslator(state?.locale ?? 'en'), [state?.locale])
  return { state, t }
}
