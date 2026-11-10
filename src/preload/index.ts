import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppState, type KellnerApi } from '@shared/ipc'

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: KellnerApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  onStateChanged: (listener) => subscribe<[AppState]>(IPC.stateChanged, listener),
  query: (text) => ipcRenderer.invoke(IPC.query, text),
  hideOverlay: () => ipcRenderer.send(IPC.hideOverlay),
  resizeOverlay: (height) => ipcRenderer.send(IPC.resizeOverlay, height),
  onOverlayShown: (listener) => subscribe<[]>(IPC.overlayShown, listener)
}

contextBridge.exposeInMainWorld('kellner', api)
