import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron'
import trayIconPath from '../../resources/tray.png?asset'
import appIconPath from '../../resources/icon.png?asset'
import winHelperPath from '../../resources/win-helper.ps1?asset'
import { createTranslator, resolveLocale, type Translate } from '@shared/i18n'
import { IPC, type AppState, type SaveSettingsResult, type Settings } from '@shared/ipc'
import { Assistant } from './assistant'
import { createPcService } from './services/pc'
import { Scheduler, SqliteItemStore } from './services/scheduler'
import { WinHelper } from './services/winHelper'
import { loadSettings, persistSettings, sanitize } from './settings'
import { skills } from './skills'
import { alertText, describeAlert } from './skills/timers'
import type { ScheduledItem } from './skills/types'
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
  let assistant: Assistant
  let scheduler: Scheduler | null = null
  const winHelper = new WinHelper(winHelperPath)

  function showAlert(item: ScheduledItem, late: boolean): void {
    const { title, body } = describeAlert(item)
    const text = late ? `${body} ${alertText(item.locale, 'late')}` : body
    new Notification({ title, body: text, icon: appIconPath, urgency: 'critical' }).show()
  }

  /** Hide the overlay and give the compositor a moment, so it isn't in the screenshot. */
  async function hideOverlayForCapture(): Promise<void> {
    if (overlay?.isVisible()) {
      overlay.hide()
      await new Promise((r) => setTimeout(r, 300))
    }
  }

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
  ipcMain.handle(IPC.query, (_e, text: unknown) => assistant.handle(String(text ?? ''), state().locale))
  ipcMain.on(IPC.hideOverlay, () => overlay?.hide())
  ipcMain.on(IPC.resizeOverlay, (_e, height: unknown) => {
    if (overlay && typeof height === 'number' && Number.isFinite(height)) resizeOverlay(overlay, height)
  })

  app.on('second-instance', showOverlay)
  // Tray app: keep running when all windows are closed.
  app.on('window-all-closed', () => {})
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    scheduler?.stop()
    winHelper.dispose()
  })

  void app.whenReady().then(() => {
    // In dev, Windows only shows toasts for an AppUserModelId tied to the running exe.
    app.setAppUserModelId(app.isPackaged ? 'com.sober-kellner.app' : process.execPath)
    settings = loadSettings()
    applyLocale()

    scheduler = new Scheduler(new SqliteItemStore(join(app.getPath('userData'), 'kellner.db')), showAlert)
    scheduler.start()
    const pc = createPcService(winHelper, hideOverlayForCapture)
    assistant = new Assistant(skills, { scheduler, pc })
    // Warm up the PowerShell helper and app list so the first command is instant.
    pc.listApps().catch((err) => console.warn('[kellner] app list unavailable:', err))

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
