import { describe, expect, it } from 'vitest'
import { Scheduler, SqliteItemStore } from '../src/main/services/scheduler'
import type { ScheduledItem } from '../src/main/skills/types'

describe('SqliteItemStore + Scheduler', () => {
  it('persists, survives a restart, and reports late items', () => {
    const store = new SqliteItemStore(':memory:')
    let clock = 1_000_000
    const fired: Array<[ScheduledItem, boolean]> = []
    const a = new Scheduler(store, (i, late) => fired.push([i, late]), () => clock)
    a.start()
    a.add({ kind: 'timer', dueAt: clock + 60_000, label: '', locale: 'en', durationMs: 60_000 })
    a.add({ kind: 'reminder', dueAt: clock + 3_600_000, label: 'call mom', locale: 'pt-BR', durationMs: null })
    a.stop()

    // "restart" two hours later: both are overdue, both reported as late
    clock += 2 * 3_600_000
    const b = new Scheduler(store, (i, late) => fired.push([i, late]), () => clock)
    b.start()
    b.stop()
    expect(fired.map(([i, late]) => [i.kind, i.label, late])).toEqual([
      ['timer', '', true],
      ['reminder', 'call mom', true]
    ])
    expect(store.all()).toHaveLength(0)
    store.close()
  })

  it('cancels', () => {
    const store = new SqliteItemStore(':memory:')
    const s = new Scheduler(store, () => {}, () => 0)
    const t = s.add({ kind: 'timer', dueAt: 1000, label: '', locale: 'en', durationMs: 1000 })
    expect(s.cancel([t.id])).toBe(1)
    expect(s.list('timer')).toEqual([])
    store.close()
  })
})
