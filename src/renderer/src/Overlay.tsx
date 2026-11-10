import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AssistantReply } from '@shared/ipc'
import { useAppState } from './useAppState'

type Exchange = { query: string; reply: AssistantReply | null }

export function Overlay(): React.JSX.Element {
  const { state, t } = useAppState()
  const [input, setInput] = useState('')
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fresh, focused prompt every time the overlay opens.
  useEffect(
    () =>
      window.kellner.onOverlayShown(() => {
        setInput('')
        setExchange(null)
        requestAnimationFrame(() => inputRef.current?.focus())
      }),
    []
  )

  // Keep the native window exactly as tall as the panel.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const observer = new ResizeObserver(() => window.kellner.resizeOverlay(panel.offsetHeight + 16))
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const query = input.trim()
    if (!query) return
    setInput('')
    setExchange({ query, reply: null })
    const reply = await window.kellner.query(query)
    setExchange((current) => (current?.query === query ? { query, reply } : current))
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') window.kellner.hideOverlay()
  }

  return (
    <div className="overlay" onKeyDown={onKeyDown}>
      <div className="panel" ref={panelRef}>
        <form className="prompt" onSubmit={submit}>
          <span className="orb" aria-hidden data-busy={exchange !== null && !exchange.reply} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={state ? t('overlay.placeholder') : ''}
            spellCheck={false}
            autoFocus
            aria-label={t('overlay.placeholder')}
          />
        </form>
        {exchange && (
          <div className="exchange">
            <div className="you">{exchange.query}</div>
            <div className="reply">{exchange.reply ? exchange.reply.text : t('overlay.thinking')}</div>
          </div>
        )}
        <div className="hint">{t('overlay.hint')}</div>
      </div>
    </div>
  )
}
