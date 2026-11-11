import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AudioPlayer } from './AudioPlayer'
import { Overlay } from './Overlay'
import { SettingsPage } from './SettingsPage'
import './styles.css'

const route = window.location.hash.replace(/^#\/?/, '')
document.documentElement.dataset.route = route

const pages: Record<string, () => React.JSX.Element | null> = {
  settings: SettingsPage,
  audio: AudioPlayer
}
const Page = pages[route] ?? Overlay

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>
)
