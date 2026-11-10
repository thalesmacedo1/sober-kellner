import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import appIcon from '../../resources/icon.png?asset'

export type Route = 'overlay' | 'settings'

export const OVERLAY_WIDTH = 680
export const OVERLAY_MIN_HEIGHT = 72
export const OVERLAY_MAX_HEIGHT = 560

const secureWebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false
}

function loadRoute(win: BrowserWindow, route: Route): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}#/${route}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
}

export function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: secureWebPreferences
  })
  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.on('blur', () => win.hide())
  loadRoute(win, 'overlay')
  return win
}

/** Centers the overlay horizontally on the display under the cursor, in the upper quarter. */
export function positionOverlay(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  const [, h] = win.getSize()
  win.setBounds({
    x: Math.round(x + (width - OVERLAY_WIDTH) / 2),
    y: Math.round(y + height * 0.22),
    width: OVERLAY_WIDTH,
    height: h
  })
}

export function resizeOverlay(win: BrowserWindow, contentHeight: number): void {
  const height = Math.round(Math.min(OVERLAY_MAX_HEIGHT, Math.max(OVERLAY_MIN_HEIGHT, contentHeight)))
  const bounds = win.getBounds()
  if (bounds.height !== height) win.setBounds({ ...bounds, height })
}

export function createSettingsWindow(title: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 420,
    title,
    icon: appIcon,
    show: false,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#14141c',
    webPreferences: secureWebPreferences
  })
  win.setMenu(null)
  win.once('ready-to-show', () => win.show())
  loadRoute(win, 'settings')
  return win
}
