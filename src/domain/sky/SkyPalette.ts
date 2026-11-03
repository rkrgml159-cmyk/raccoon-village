import palette from '../../../data/sky-palette.json'

export interface SkyColors {
  top: string
  bottom: string
  horizon: string
  starAlpha: number
}

const table: Record<string, SkyColors> = palette
const FALLBACK = 'spring-day'

export function getSky(key: string): SkyColors {
  return { ...(table[key] ?? table[FALLBACK]) }
}

export function lerpHex(a: string, b: string, t: number): string {
  const k = t > 0 ? Math.min(t, 1) : 0
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k)
    out += v.toString(16).padStart(2, '0')
  }
  return out
}

export function lerpSky(a: SkyColors, b: SkyColors, t: number): SkyColors {
  return {
    top: lerpHex(a.top, b.top, t),
    bottom: lerpHex(a.bottom, b.bottom, t),
    horizon: lerpHex(a.horizon, b.horizon, t),
    starAlpha: a.starAlpha + (b.starAlpha - a.starAlpha) * t,
  }
}

export class SkyBlender {
  private from: SkyColors
  private target: SkyColors
  private progress = 1
  private cur: SkyColors

  constructor(
    initial: SkyColors,
    private readonly durationMs = 60000,
  ) {
    this.from = this.target = this.cur = { ...initial }
  }

  setTarget(c: SkyColors): void {
    this.from = this.cur
    this.target = { ...c }
    this.progress = 0
  }

  snapTo(c: SkyColors): void {
    this.from = this.target = this.cur = { ...c }
    this.progress = 1
  }

  update(dtMs: number): SkyColors {
    if (this.progress < 1) {
      this.progress = this.durationMs > 0 ? Math.min(1, this.progress + dtMs / this.durationMs) : 1
      this.cur =
        this.progress >= 1 ? { ...this.target } : lerpSky(this.from, this.target, this.progress)
    }
    return this.current
  }

  get current(): SkyColors {
    return { ...this.cur }
  }
}
