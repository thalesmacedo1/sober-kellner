import { useEffect } from 'react'

/**
 * Lives in the hidden audio window. Plays the WAV files Piper produces, one at a time:
 * a new clip or a stop request cuts off whatever is playing.
 */
export function AudioPlayer(): null {
  useEffect(() => {
    const ctx = new AudioContext()
    let current: AudioBufferSourceNode | null = null
    let token = 0

    const stop = (): void => {
      token++
      if (current) {
        current.onended = null
        current.stop()
        current = null
        window.kellner.reportSpeaking(false)
      }
    }

    const offPlay = window.kellner.onAudioPlay(async (wav) => {
      stop()
      const mine = token
      // decodeAudioData takes ownership of the buffer, so hand it a copy of just these bytes.
      const bytes = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer
      const buffer = await ctx.decodeAudioData(bytes)
      if (mine !== token) return // a newer clip or a stop arrived while decoding
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        if (current !== source) return
        current = null
        window.kellner.reportSpeaking(false)
      }
      current = source
      source.start()
      window.kellner.reportSpeaking(true)
    })
    const offStop = window.kellner.onAudioStop(stop)

    return () => {
      offPlay()
      offStop()
      stop()
      void ctx.close()
    }
  }, [])
  return null
}
