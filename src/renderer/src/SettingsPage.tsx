import { useEffect, useState, type FormEvent } from 'react'
import { LOCALES, LOCALE_NAMES, type LanguageSetting } from '@shared/i18n'
import type { Settings } from '@shared/ipc'
import { useAppState } from './useAppState'

type Status = 'idle' | 'saved' | 'hotkey-error'

export function SettingsPage(): React.JSX.Element | null {
  const { state, t } = useAppState()
  const [draft, setDraft] = useState<Settings | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (state && !draft) setDraft(state.settings)
  }, [state, draft])

  useEffect(() => {
    document.title = t('settings.title')
  }, [t])

  if (!draft) return null

  const update = (patch: Partial<Settings>): void => {
    setDraft({ ...draft, ...patch })
    setStatus('idle')
  }

  async function save(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!draft) return
    const result = await window.kellner.saveSettings(draft)
    if (result.ok) {
      setDraft(result.state.settings)
      setStatus('saved')
    } else {
      setStatus('hotkey-error')
    }
  }

  return (
    <form className="settings" onSubmit={save}>
      <h1>{t('settings.title')}</h1>

      <label className="field">
        <span>{t('settings.language')}</span>
        <select
          value={draft.language}
          onChange={(e) => update({ language: e.target.value as LanguageSetting })}
        >
          <option value="auto">{t('settings.language.auto')}</option>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_NAMES[locale]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('settings.hotkey')}</span>
        <input
          value={draft.hotkey}
          onChange={(e) => update({ hotkey: e.target.value })}
          spellCheck={false}
          aria-invalid={status === 'hotkey-error'}
        />
        <small>{t('settings.hotkey.help')}</small>
      </label>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={draft.voice}
          onChange={(e) => update({ voice: e.target.checked })}
        />
        <span>{t('settings.voice')}</span>
      </label>
      {draft.voice && state && !state.voiceAvailable && (
        <small className="warning">{t('settings.voice.missing')}</small>
      )}

      <div className="actions">
        <span className="status" role="status" data-kind={status}>
          {status === 'saved' && t('settings.saved')}
          {status === 'hotkey-error' && t('settings.error.hotkey')}
        </span>
        <button type="submit">{t('settings.save')}</button>
      </div>
    </form>
  )
}
