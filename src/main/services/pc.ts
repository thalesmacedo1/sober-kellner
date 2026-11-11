import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, desktopCapturer, screen, shell } from 'electron'
import type { AppEntry, KnownFolder, PcService, VolumeState } from '../skills/types'
import type { WinHelper } from './winHelper'

const VK = { playPause: 0xb3, next: 0xb0, previous: 0xb1 } as const
const APP_CACHE_MS = 10 * 60 * 1000

const FOLDER_PATHS: Record<KnownFolder, Parameters<typeof app.getPath>[0]> = {
  home: 'home', desktop: 'desktop', documents: 'documents', downloads: 'downloads',
  music: 'music', pictures: 'pictures', videos: 'videos'
}

export function createPcService(helper: WinHelper, beforeCapture: () => Promise<void>): PcService {
  let apps: { list: AppEntry[]; at: number } | null = null

  return {
    async openFolder(folder) {
      const err = await shell.openPath(app.getPath(FOLDER_PATHS[folder]))
      if (err) throw new Error(err)
    },

    async listApps() {
      if (!apps || Date.now() - apps.at > APP_CACHE_MS) {
        apps = { list: await helper.call<AppEntry[]>('apps', {}, 30_000), at: Date.now() }
      }
      return apps.list
    },

    async launchApp(entry) {
      // Works for both classic (.exe/.lnk) and Store apps.
      spawn('explorer.exe', [`shell:AppsFolder\\${entry.id}`], { detached: true, stdio: 'ignore' }).unref()
    },

    getVolume: () => helper.call<VolumeState>('volume.get'),
    setVolume: (level) => helper.call<VolumeState>('volume.set', { level: Math.round(level) }),
    setMuted: (muted) => helper.call<VolumeState>('volume.mute', { muted }),

    async mediaKey(key) {
      await helper.call('key', { vk: VK[key] })
    },

    async lock() {
      await helper.call('lock')
    },

    async screenshot() {
      await beforeCapture()
      const display = screen.getPrimaryDisplay()
      const { width, height } = display.size
      const [source] = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.round(width * display.scaleFactor), height: Math.round(height * display.scaleFactor) }
      })
      if (!source) throw new Error('no screen source')
      const dir = join(app.getPath('pictures'), 'Screenshots')
      mkdirSync(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const file = join(dir, `Kellner ${stamp}.png`)
      writeFileSync(file, source.thumbnail.toPNG())
      return file
    }
  }
}
