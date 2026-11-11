import { Scheduler, type ItemStore } from '../src/main/services/scheduler'
import type { AppEntry, PcService, ScheduledItem, Services, VolumeState } from '../src/main/skills/types'

/** Wednesday, Nov 11 2026, 10:00 local time. */
export const NOW = new Date(2026, 10, 11, 10, 0, 0)

export class MemoryStore implements ItemStore {
  items: ScheduledItem[] = []
  private id = 1
  insert(item: Omit<ScheduledItem, 'id'>): ScheduledItem {
    const full = { ...item, id: this.id++ }
    this.items.push(full)
    return full
  }
  all(): ScheduledItem[] {
    return [...this.items]
  }
  delete(ids: number[]): number {
    const before = this.items.length
    this.items = this.items.filter((i) => !ids.includes(i.id))
    return before - this.items.length
  }
}

export const FAKE_APPS: AppEntry[] = [
  { name: 'Calculadora', id: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' },
  { name: 'Bloco de Notas', id: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe!App' },
  { name: 'Spotify', id: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify' },
  { name: 'Google Chrome', id: 'Chrome' },
  { name: 'Uninstall Google Chrome', id: 'ChromeUninstall' },
  { name: 'Visual Studio Code', id: 'Microsoft.VisualStudioCode' },
  { name: 'Configurações', id: 'windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel' },
  { name: 'Explorador de Arquivos', id: 'Microsoft.Windows.Explorer' },
  { name: 'Microsoft Word', id: 'Word' },
  { name: '7-Zip Help', id: '7zhelp' }
]

export function fakeServices() {
  const calls: string[] = []
  let volume: VolumeState = { level: 40, muted: false }
  const pc: PcService = {
    openFolder: async (f) => void calls.push(`openFolder:${f}`),
    listApps: async () => FAKE_APPS,
    launchApp: async (a) => void calls.push(`launch:${a.name}`),
    getVolume: async () => volume,
    setVolume: async (level) => {
      calls.push(`setVolume:${level}`)
      return (volume = { ...volume, level })
    },
    setMuted: async (muted) => {
      calls.push(`setMuted:${muted}`)
      return (volume = { ...volume, muted })
    },
    mediaKey: async (k) => void calls.push(`media:${k}`),
    lock: async () => void calls.push('lock'),
    screenshot: async () => 'C:\\shots\\x.png'
  }
  const store = new MemoryStore()
  let clock = NOW.getTime()
  const fired: Array<{ item: ScheduledItem; late: boolean }> = []
  const scheduler = new Scheduler(store, (item, late) => fired.push({ item, late }), () => clock)
  const services: Services = { scheduler, pc }
  return {
    services,
    calls,
    store,
    scheduler,
    fired,
    advance: (ms: number) => (clock += ms),
    get volume() {
      return volume
    }
  }
}
