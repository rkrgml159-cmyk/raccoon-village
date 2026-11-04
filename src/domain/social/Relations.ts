import type { DuetType } from './types'

export type Band = 'awkward' | 'neutral' | 'friend' | 'bestie'

/** 띠별 듀엣 배율. 목록에 없는 종류는 1 (awkward는 0.5). */
export const BAND_MULTIPLIER: Record<Band, Partial<Record<DuetType, number>>> = {
  awkward: { greet: 1.5, quarrel: 1.5 },
  neutral: {},
  friend: { chat: 1.3, sitTogether: 1.3, groom: 1.3 },
  bestie: { sitTogether: 1.6, quarrel: 0.2 },
}

export const DECAY_PER_DAY = 0.02

const MS_PER_DAY = 86_400_000

const AWKWARD_THRESHOLD = -0.2
const FRIEND_THRESHOLD = 0.3
const BESTIE_THRESHOLD = 0.7

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function bandOf(v: number): Band {
  if (v < AWKWARD_THRESHOLD) return 'awkward'
  if (v >= BESTIE_THRESHOLD) return 'bestie'
  if (v >= FRIEND_THRESHOLD) return 'friend'
  return 'neutral'
}

export function bandMultiplier(band: Band, type: DuetType): number {
  const listed = BAND_MULTIPLIER[band][type]
  if (listed !== undefined) return listed
  return band === 'awkward' ? 0.5 : 1
}

export class RelationTable {
  private readonly values = new Map<string, number>()

  get(a: string, b: string): number {
    return this.values.get(pairKey(a, b)) ?? 0
  }

  add(a: string, b: string, delta: number): number {
    const key = pairKey(a, b)
    const next = clamp((this.values.get(key) ?? 0) + delta, -1, 1)
    this.values.set(key, next)
    return next
  }

  band(a: string, b: string): Band {
    return bandOf(this.get(a, b))
  }

  has(a: string, b: string): boolean {
    return this.values.has(pairKey(a, b))
  }

  decay(simDtMs: number): void {
    const step = (DECAY_PER_DAY * simDtMs) / MS_PER_DAY
    for (const [key, v] of this.values) {
      if (v > 0) this.values.set(key, Math.max(0, v - step))
      else if (v < 0) this.values.set(key, Math.min(0, v + step))
    }
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.values)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
