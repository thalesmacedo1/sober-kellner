import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import trayIconPath from '../../resources/tray.png?asset'
import { createTranslator, resolveLocale, type Translate } from '@shared/i18n'
import { IPC, type AppState, type SaveSettingsResult, type Settings } from '@shared/ipc'
import { handleQuery } from './assistant'
import { loadSettings, persistSettings, sanitize } from './settings'
import {
  createOverlayWindow,
  createSettingsWindow,
  positionOverlay,
  resizeOverlay
} from './windows'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let settings: Settings
  let t: Translate
  let tray: Tray | null = null
  let overlay: BrowserWindow | null = null
  let settingsWin: BrowserWindow | null = null

  const state = (): AppState => ({
    settings,
    locale: resolveLocale(settings.language, app.getLocale())
  })

  const applyLocale = (): void => {
    t = createTranslator(state().locale)
  }

  function showOverlay(): void {
    if (!overlay || overlay.isDestroyed()) overlay = createOverlayWindow()
    positionOverlay(overlay)
    overlay.show()
    overlay.focus()
    overlay.webContents.send(IPC.overlayShown)
  }

  function toggleOverlay(): void {
    if (overlay?.isVisible()) overlay.hide()
    else showOverlay()
  }

  function openSettings(): void {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.focus()
      return
    }
    settingsWin = createSettingsWindow(t('settings.title'))
    settingsWin.on('closed', () => (settingsWin = null))
  }

  function buildTrayMenu(): void {
    if (!tray) return
    tray.setToolTip(t('app.name'))
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t('tray.open'), accelerator: settings.hotkey, click: showOverlay },
        { label: t('tray.settings'), click: openSettings },
        { type: 'separator' },
        { label: t('tray.quit'), click: () => app.quit() }
      ])
    )
  }

  function registerHotkey(accelerator: string): boolean {
    try {
      return globalShortcut.register(accelerator, toggleOverlay)
    } catch {
      return false // invalid accelerator string
    }
  }

  function broadcastState(): void {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.stateChanged, state())
  }

  function saveSettings(input: Settings): SaveSettingsResult {
    const next = sanitize(input)
    if (next.hotkey !== settings.hotkey) {
      globalShortcut.unregister(settings.hotkey)
      if (!registerHotkey(next.hotkey)) {
        registerHotkey(settings.hotkey)
        return { ok: false, error: 'hotkey' }
      }
    }
    settings = next
    persistSettings(settings)
    applyLocale()
    buildTrayMenu()
    settingsWin?.setTitle(t('settings.title'))
    broadcastState()
    return { ok: true, state: state() }
  }

  ipcMain.handle(IPC.getState, () => state())
  ipcMain.handle(IPC.saveSettings, (_e, input: Settings) => saveSettings(input))
  ipcMain.handle(IPC.query, (_e, text: unknown) => handleQuery(String(text ?? ''), t))
  ipcMain.on(IPC.hideOverlay, () => overlay?.hide())
  ipcMain.on(IPC.resizeOverlay, (_e, height: unknown) => {
    if (overlay && typeof height === 'number' && Number.isFinite(height)) resizeOverlay(overlay, height)
  })

  app.on('second-instance', showOverlay)
  // Tray app: keep running when all windows are closed.
  app.on('window-all-closed', () => {})
  app.on('will-quit', () => globalShortcut.unregisterAll())

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.sober-kellner.app')
    settings = loadSettings()
    applyLocale()

    tray = new Tray(nativeImage.createFromPath(trayIconPath))
    tray.on('click', toggleOverlay)
    buildTrayMenu()

    overlay = createOverlayWindow() // pre-load so the first hotkey press is instant
    if (!registerHotkey(settings.hotkey)) {
      console.warn(`[kellner] could not register hotkey ${settings.hotkey}`)
      openSettings()
    }
  })
}
