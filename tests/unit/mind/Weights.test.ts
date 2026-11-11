import { describe, expect, it } from 'vitest'
import { DEFAULT_EXTRA, composeWeights } from '@domain/mind/Weights'
import type { TraitTable } from '@domain/mind/Traits'

const base = { idle: 0.6, walk: 0.2, sit: 0.12, sleep: 0.08, forage: 0.1, approach: 0.1 }
const zero = { hunger: 0, sleepy: 0, bored: 0, lonely: 0 }
const table = {
  calm: {},
  curious: {},
  timid: {},
  glutton: {},
  chatty: { approach: 1.6 },
  dreamer: {},
  tidy: {},
  nightowl: {},
} as unknown as TraitTable

describe('composeWeights', () => {
  it('needs raise matching weights', () => {
    const w = composeWeights(base, { ...zero, hunger: 1 }, [], table)
    expect(w.forage).toBeCloseTo(0.3, 6)
    expect(w.idle).toBeCloseTo(0.6, 6)
    const s = composeWeights(base, { ...zero, sleepy: 1 }, [], table)
    expect(s.sleep).toBeCloseTo(0.24, 6)
    const l = composeWeights(base, { ...zero, lonely: 1, bored: 1 }, [], table)
    expect(l.approach).toBeCloseTo(0.1 * (1 + 2 + 1), 6)
    expect(l.walk).toBeCloseTo(0.4, 6)
  })
  it('traits multiply', () => {
    const w = composeWeights(base, zero, ['chatty'], table)
    expect(w.approach).toBeCloseTo(0.16, 6)
    expect(w.sleep).toBeCloseTo(0.08, 6)
  })
  it('defaults when species omits forage/approach', () => {
    const w = composeWeights({ idle: 1, walk: 1, sit: 1, sleep: 1 }, zero, [], table)
    expect(w.forage).toBe(DEFAULT_EXTRA.forage)
    expect(w.approach).toBe(DEFAULT_EXTRA.approach)
  })
  it('returns a fresh object', () => {
    expect(composeWeights(base, zero, [], table)).not.toBe(base)
  })
})
