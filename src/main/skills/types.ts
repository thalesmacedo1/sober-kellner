import type { Locale } from '@shared/i18n'
import type { Token } from '../nlu/text'

export interface Reply {
  text: string
  /** Hide the overlay shortly after showing the reply (e.g. after launching an app). */
  dismiss?: boolean
}

export type SlotType = 'text' | 'duration' | 'number' | 'percent'

export interface SlotValue {
  /** original text as typed/spoken, e.g. "ligar pra mãe amanhã" */
  text: string
  tokens: Token[]
  /** the full original input, for slicing around tokens */
  source: string
  /** parsed value for duration (ms), number and percent slots */
  value?: number
}

export interface IntentContext {
  locale: Locale
  now: Date
  slots: Record<string, SlotValue>
  services: Services
}

export interface Intent {
  id: string
  patterns: Record<Locale, string[]>
  slots?: Record<string, SlotType>
  handle(ctx: IntentContext): Reply | Promise<Reply>
}

export interface Skill {
  id: string
  intents: Intent[]
}

// ---------- services the skills can use (implemented in main, faked in tests) ----------

export type ItemKind = 'timer' | 'reminder'

export interface ScheduledItem {
  id: number
  kind: ItemKind
  dueAt: number
  createdAt: number
  label: string
  locale: Locale
  durationMs: number | null
}

export type NewItem = Omit<ScheduledItem, 'id' | 'createdAt'>

export interface SchedulerService {
  add(item: NewItem): ScheduledItem
  /** pending items of a kind, soonest first */
  list(kind: ItemKind): ScheduledItem[]
  cancel(ids: number[]): number
}

export type KnownFolder = 'home' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

export interface AppEntry {
  name: string
  id: string
}

export interface VolumeState {
  level: number
  muted: boolean
}

export interface PcService {
  openFolder(folder: KnownFolder): Promise<void>
  listApps(): Promise<AppEntry[]>
  launchApp(app: AppEntry): Promise<void>
  getVolume(): Promise<VolumeState>
  setVolume(level: number): Promise<VolumeState>
  setMuted(muted: boolean): Promise<VolumeState>
  mediaKey(key: 'playPause' | 'next' | 'previous'): Promise<void>
  lock(): Promise<void>
  /** returns the saved file path */
  screenshot(): Promise<string>
}

export interface Services {
  scheduler: SchedulerService
  pc: PcService
}
