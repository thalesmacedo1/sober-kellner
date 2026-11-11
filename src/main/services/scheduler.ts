import { DatabaseSync } from 'node:sqlite'
import type { Locale } from '@shared/i18n'
import type { ItemKind, NewItem, ScheduledItem, SchedulerService } from '../skills/types'

export interface ItemStore {
  insert(item: Omit<ScheduledItem, 'id'>): ScheduledItem
  all(): ScheduledItem[]
  delete(ids: number[]): number
}

/** Timers and reminders persisted in SQLite (node:sqlite, built into Electron — no native module). */
export class SqliteItemStore implements ItemStore {
  private readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('timer', 'reminder')),
        due_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        locale TEXT NOT NULL,
        duration_ms INTEGER
      )`)
  }

  insert(item: Omit<ScheduledItem, 'id'>): ScheduledItem {
    const r = this.db
      .prepare('INSERT INTO scheduled_items (kind, due_at, created_at, label, locale, duration_ms) VALUES (?, ?, ?, ?, ?, ?)')
      .run(item.kind, item.dueAt, item.createdAt, item.label, item.locale, item.durationMs)
    return { ...item, id: Number(r.lastInsertRowid) }
  }

  all(): ScheduledItem[] {
    const rows = this.db.prepare('SELECT * FROM scheduled_items ORDER BY due_at').all() as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind as ItemKind,
      dueAt: Number(r.due_at),
      createdAt: Number(r.created_at),
      label: String(r.label),
      locale: r.locale as Locale,
      durationMs: r.duration_ms === null ? null : Number(r.duration_ms)
    }))
  }

  delete(ids: number[]): number {
    if (!ids.length) return 0
    const r = this.db.prepare(`DELETE FROM scheduled_items WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
    return Number(r.changes)
  }

  close(): void {
    this.db.close()
  }
}

export type FireHandler = (item: ScheduledItem, late: boolean) => void

/** Items older than this when the app starts are reported as "late" (fired while the app was closed). */
const LATE_AFTER_MS = 60_000

/**
 * Fires due items. Polls once a second instead of one setTimeout per item, so it stays correct
 * across sleep/hibernate and doesn't hit setTimeout's ~24.8-day limit.
 */
export class Scheduler implements SchedulerService {
  private items: ScheduledItem[] = []
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly store: ItemStore,
    private readonly onFire: FireHandler,
    private readonly now: () => number = Date.now
  ) {}

  start(): void {
    this.items = this.store.all()
    this.tick()
    this.interval = setInterval(() => this.tick(), 1000)
    this.interval.unref?.()
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }

  add(input: NewItem): ScheduledItem {
    const item = this.store.insert({ ...input, createdAt: this.now() })
    this.items.push(item)
    return item
  }

  list(kind: ItemKind): ScheduledItem[] {
    return this.items.filter((i) => i.kind === kind).sort((a, b) => a.dueAt - b.dueAt)
  }

  cancel(ids: number[]): number {
    this.items = this.items.filter((i) => !ids.includes(i.id))
    return this.store.delete(ids)
  }

  /** Exposed for tests. */
  tick(): void {
    const now = this.now()
    const due = this.items.filter((i) => i.dueAt <= now)
    if (!due.length) return
    this.items = this.items.filter((i) => i.dueAt > now)
    this.store.delete(due.map((i) => i.id))
    for (const item of due) {
      try {
        this.onFire(item, now - item.dueAt > LATE_AFTER_MS)
      } catch (err) {
        console.error('[scheduler] alert failed', err)
      }
    }
  }
}
