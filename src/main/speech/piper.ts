import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { dirname } from 'node:path'

interface Pending {
  resolve: (file: string) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

/**
 * One long-lived `piper.exe --json-input` process per voice, so the model loads once.
 * Each request is a JSON line with an output file; Piper prints that path when the WAV is written.
 * Requests are answered in order, so a FIFO of pending promises is enough.
 */
export class PiperVoice {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending: Pending[] = []
  private buffer = ''

  constructor(
    private readonly exe: string,
    private readonly model: string
  ) {}

  synthesize(text: string, outFile: string, timeoutMs = 15_000): Promise<string> {
    const proc = this.start()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // A stuck synth would block every later request: restart the process.
        this.fail(new Error('piper timed out'))
        proc.kill()
      }, timeoutMs)
      this.pending.push({ resolve, reject, timer })
      proc.stdin.write(JSON.stringify({ text, output_file: outFile }) + '\n')
    })
  }

  dispose(): void {
    this.proc?.stdin.end()
    this.proc?.kill()
    this.proc = null
  }

  private start(): ChildProcessWithoutNullStreams {
    if (this.proc) return this.proc
    const proc = spawn(this.exe, ['--model', this.model, '--json-input', '--quiet'], {
      cwd: dirname(this.exe),
      windowsHide: true
    })
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      let nl: number
      while ((nl = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, nl).trim()
        this.buffer = this.buffer.slice(nl + 1)
        if (!line) continue
        const next = this.pending.shift()
        if (next) {
          clearTimeout(next.timer)
          next.resolve(line)
        }
      }
    })
    proc.stderr.on('data', (d) => console.warn('[piper]', String(d).trim()))
    const onGone = (err?: Error): void => {
      if (this.proc !== proc) return
      this.proc = null
      this.buffer = ''
      this.fail(err ?? new Error('piper exited'))
    }
    proc.on('error', onGone)
    proc.on('exit', () => onGone())
    this.proc = proc
    return proc
  }

  private fail(err: Error): void {
    for (const p of this.pending.splice(0)) {
      clearTimeout(p.timer)
      p.reject(err)
    }
  }
}
