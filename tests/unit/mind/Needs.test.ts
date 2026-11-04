import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import {
  NEED_FULL_MS,
  advanceNeeds,
  initialNeeds,
  needIcons,
  relieve,
  type NeedKey,
  type Needs,
} from '@domain/mind/Needs'

const n = (over: Partial<Needs> = {}): Needs => ({
  hunger: 0,
  sleepy: 0,
  bored: 0,
  lonely: 0,
  ...over,
})

describe('Needs', () => {
  it('initialNeeds within [0.2,0.6]', () => {
    for (let s = 1; s <= 100; s++) {
      const v = initialNeeds(mulberry32(s))
      for (const k of Object.keys(v) as NeedKey[]) {
        expect(v[k]).toBeGreaterThanOrEqual(0.2)
        expect(v[k]).toBeLessThanOrEqual(0.6)
      }
    }
  })

  it('advanceNeeds reaches 1 after NEED_FULL_MS', () => {
    const v = advanceNeeds(n(), NEED_FULL_MS.hunger, {})
    expect(v.hunger).toBeCloseTo(1, 9)
    expect(v.sleepy).toBeCloseTo(NEED_FULL_MS.hunger / NEED_FULL_MS.sleepy, 9)
  })

  it('clamps at 1 for huge simDt', () => {
    let v = n()
    for (let i = 0; i < 1000; i++) v = advanceNeeds(v, 3600 * 16, {})
    expect(v).toEqual({ hunger: 1, sleepy: 1, bored: 1, lonely: 1 })
  })

  it('mods scale the rate', () => {
    const base = advanceNeeds(n(), 1_000_000, {})
    const fast = advanceNeeds(n(), 1_000_000, { hunger: 1.3 })
    expect(fast.hunger).toBeCloseTo(base.hunger * 1.3, 9)
    expect(fast.sleepy).toBeCloseTo(base.sleepy, 9)
  })

  it('relieve clamps at 0', () => {
    const v = relieve(n({ hunger: 0.3, bored: 0.5 }), { hunger: 0.5, bored: 0.2 })
    expect(v.hunger).toBe(0)
    expect(v.bored).toBeCloseTo(0.3, 9)
  })

  it('needIcons fires once above 0.8 then not again until below 0.5', () => {
    let shown = new Set<NeedKey>()
    let r = needIcons(n({ hunger: 0.85 }), shown)
    expect(r.fire).toEqual(['hunger'])
    shown = r.shown
    r = needIcons(n({ hunger: 0.9 }), shown)
    expect(r.fire).toEqual([])
    shown = r.shown
    r = needIcons(n({ hunger: 0.4 }), shown)
    expect(r.shown.has('hunger')).toBe(false)
    shown = r.shown
    r = needIcons(n({ hunger: 0.85 }), shown)
    expect(r.fire).toEqual(['hunger'])
  })

  it('needIcons does not mutate its input set', () => {
    const shown = new Set<NeedKey>()
    needIcons(n({ hunger: 0.9 }), shown)
    expect(shown.size).toBe(0)
  })
})
