import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay } from './Overlay'
import { SettingsPage } from './SettingsPage'
import './styles.css'

const route = window.location.hash.replace(/^#\/?/, '')
document.documentElement.dataset.route = route

createRoot(document.getElementById('root')!).render(
  <StrictMode>{route === 'settings' ? <SettingsPage /> : <Overlay />}</StrictMode>
)
