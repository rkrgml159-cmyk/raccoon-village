import type { Season } from '@domain/time/DateContext'

export type WindState = 'off' | 'running' | 'suspended' | 'unavailable'

const CUTOFF: Record<Season, number> = { spring: 600, summer: 900, autumn: 600, winter: 400 }
const BUFFER_SECONDS = 2
const SUSPEND_DELAY_MS = 220

/** Pink noise (Paul Kellet's filter) over white noise. */
function fillPinkNoise(data: Float32Array): void {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
}

export class WindSynth {
  private _state: WindState = 'off'
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private season: Season = 'spring'
  private suspendTimer: ReturnType<typeof setTimeout> | null = null
  private starting: Promise<void> | null = null

  get state(): WindState {
    return this._state
  }

  async start(): Promise<void> {
    if (this._state === 'unavailable') return
    if (this.ctx) {
      this.fadeTo(0.12)
      return
    }
    this.starting ??= this.build()
    await this.starting
  }

  private async build(): Promise<void> {
    try {
      if (typeof AudioContext === 'undefined') throw new Error('no AudioContext')
      const ctx = new AudioContext()
      const buffer = ctx.createBuffer(1, ctx.sampleRate * BUFFER_SECONDS, ctx.sampleRate)
      fillPinkNoise(buffer.getChannelData(0))
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = CUTOFF[this.season]

      const gust = ctx.createGain()
      gust.gain.value = 0.85
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.2
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 0.15
      lfo.connect(lfoDepth).connect(gust.gain)

      const master = ctx.createGain()
      master.gain.value = 0

      source.connect(filter).connect(gust).connect(master).connect(ctx.destination)
      source.start()
      lfo.start()

      this.ctx = ctx
      this.master = master
      this.filter = filter
      await ctx.resume()
      this._state = 'running'
      this.fadeTo(0.12, 200)
    } catch (e) {
      console.warn('WindSynth: audio unavailable, continuing silently', e)
      this.ctx = null
      this._state = 'unavailable'
    }
  }

  setSeason(s: Season): void {
    this.season = s
    if (this.ctx && this.filter) {
      const t = this.ctx.currentTime
      this.filter.frequency.cancelScheduledValues(t)
      this.filter.frequency.setValueAtTime(this.filter.frequency.value, t)
      this.filter.frequency.linearRampToValueAtTime(CUTOFF[s], t + 2)
    }
  }

  fadeTo(gain: number, ms = 200): void {
    const { ctx, master } = this
    if (!ctx || !master) return
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer)
      this.suspendTimer = null
    }
    if (ctx.state === 'suspended') void ctx.resume()
    if (this._state === 'suspended') this._state = 'running'
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(gain, t + Math.max(ms, 200) / 1000)
  }

  suspend(): void {
    const { ctx } = this
    if (!ctx || this._state !== 'running') return
    this.fadeTo(0)
    if (this.suspendTimer) clearTimeout(this.suspendTimer)
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null
      this._state = 'suspended'
      void ctx.suspend()
    }, SUSPEND_DELAY_MS)
  }
}
