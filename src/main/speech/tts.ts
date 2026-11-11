import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locale } from '@shared/i18n'
import { PiperVoice } from './piper'
import { toSpeakable } from './speakable'

/** Voice file per language, as downloaded by `npm run models`. */
export const VOICE_FILES: Record<Locale, string> = {
  en: 'en_US-lessac-medium.onnx',
  'pt-BR': 'pt_BR-faber-medium.onnx'
}

export interface AudioSink {
  play(wav: Uint8Array): void
  stop(): void
}

/**
 * Text → speech with local Piper voices. Only the newest request is heard:
 * a reply that finishes synthesizing after a newer one (or after stop()) is dropped.
 */
export class Tts {
  private readonly voices = new Map<Locale, PiperVoice>()
  private generation = 0
  private fileSeq = 0

  constructor(
    private readonly modelsDir: string,
    private readonly tempDir: string,
    private readonly sink: AudioSink
  ) {}

  private get exe(): string {
    return join(this.modelsDir, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper')
  }

  private modelFor(locale: Locale): string {
    return join(this.modelsDir, 'voices', VOICE_FILES[locale])
  }

  /** True when Piper and the voice for this language have been downloaded. */
  available(locale?: Locale): boolean {
    const locales = locale ? [locale] : (Object.keys(VOICE_FILES) as Locale[])
    return existsSync(this.exe) && locales.every((l) => existsSync(this.modelFor(l)))
  }

  private voice(locale: Locale): PiperVoice {
    let voice = this.voices.get(locale)
    if (!voice) {
      voice = new PiperVoice(this.exe, this.modelFor(locale))
      this.voices.set(locale, voice)
    }
    return voice
  }

  /** Starts the voice process ahead of time so the first reply has no startup delay. */
  warmUp(locale: Locale): void {
    if (this.available(locale)) void this.synthesize('.', locale).catch(() => {})
  }

  async speak(text: string, locale: Locale): Promise<void> {
    const generation = ++this.generation
    const spoken = toSpeakable(text, locale)
    if (!spoken || !this.available(locale)) return
    const wav = await this.synthesize(spoken, locale)
    if (generation === this.generation) this.sink.play(wav)
  }

  stop(): void {
    this.generation++
    this.sink.stop()
  }

  dispose(): void {
    for (const voice of this.voices.values()) voice.dispose()
    this.voices.clear()
  }

  private async synthesize(text: string, locale: Locale): Promise<Uint8Array> {
    mkdirSync(this.tempDir, { recursive: true })
    const file = join(this.tempDir, `${process.pid}-${++this.fileSeq}.wav`)
    try {
      await this.voice(locale).synthesize(text, file)
      return await readFile(file)
    } finally {
      void rm(file, { force: true })
    }
  }
}
