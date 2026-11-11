import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

interface Pending {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Talks to resources/win-helper.ps1, a long-lived PowerShell process that does volume (Core Audio),
 * media keys, lock and the Start-menu app list. Starts lazily and restarts if it dies.
 */
export class WinHelper {
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()

  constructor(private readonly scriptPath: string) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      const proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
        { windowsHide: true }
      )
      this.proc = proc
      const startup = setTimeout(() => reject(new Error('win-helper did not start in time')), 15_000)

      createInterface({ input: proc.stdout }).on('line', (line) => {
        if (!line.trim()) return
        let msg: { ready?: boolean; id?: number; ok?: boolean; result?: unknown }
        try {
          msg = JSON.parse(line)
        } catch {
          return
        }
        if (msg.ready) {
          clearTimeout(startup)
          resolve()
          return
        }
        const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined
        if (!p) return
        clearTimeout(p.timer)
        this.pending.delete(msg.id!)
        if (msg.ok) p.resolve(msg.result)
        else p.reject(new Error(String(msg.result)))
      })
      proc.stderr.on('data', (d) => console.error('[win-helper]', String(d).trim()))
      proc.on('exit', () => {
        clearTimeout(startup)
        reject(new Error('win-helper exited'))
        for (const p of this.pending.values()) {
          clearTimeout(p.timer)
          p.reject(new Error('win-helper exited'))
        }
        this.pending.clear()
        this.proc = null
        this.ready = null
      })
    })
    return this.ready
  }

  async call<T>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    await this.start()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`win-helper timeout: ${cmd}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.proc!.stdin.write(JSON.stringify({ id, cmd, args }) + '\n')
    })
  }

  dispose(): void {
    this.proc?.stdin.end()
    this.proc?.kill()
  }
}
