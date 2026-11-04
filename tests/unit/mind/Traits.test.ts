import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import { TRAITS, assignTraits, traitMultiplier, validateTraitTable } from '@domain/mind/Traits'
import { BEHAVIOR_TRAITS } from '@domain/sprites/catalog'

describe('Traits', () => {
  it('assignTraits gives two distinct traits', () => {
    for (let s = 1; s <= 200; s++) {
      const [a, b] = assignTraits(mulberry32(s))
      expect(a).not.toBe(b)
      expect(TRAITS).toContain(a)
      expect(TRAITS).toContain(b)
    }
  })

  it('deterministic for seed', () => {
    expect(assignTraits(mulberry32(7))).toEqual(assignTraits(mulberry32(7)))
  })

  it('traitMultiplier multiplies across traits', () => {
    expect(traitMultiplier(['chatty', 'curious'], 'approach', BEHAVIOR_TRAITS)).toBeCloseTo(
      1.6 * 1.2,
      9,
    )
  })

  it('1 when absent', () => {
    expect(traitMultiplier(['calm'], 'nope', BEHAVIOR_TRAITS)).toBe(1)
    expect(traitMultiplier([], 'idle', BEHAVIOR_TRAITS)).toBe(1)
  })

  it('real traits.json validates and has all 8', () => {
    expect(Object.keys(validateTraitTable(BEHAVIOR_TRAITS)).sort()).toEqual([...TRAITS].sort())
  })

  it('validateTraitTable rejects non-number', () => {
    const bad = { ...BEHAVIOR_TRAITS, calm: { idle: 'x' } }
    expect(() => validateTraitTable(bad)).toThrow(/^traits: /)
  })

  it('validateTraitTable rejects missing/extra traits and non-objects', () => {
    expect(() => validateTraitTable(null)).toThrow(/^traits: /)
    expect(() => validateTraitTable({})).toThrow(/^traits: /)
    expect(() => validateTraitTable({ ...BEHAVIOR_TRAITS, extra: {} })).toThrow(/^traits: /)
    expect(() => validateTraitTable({ ...BEHAVIOR_TRAITS, calm: [] })).toThrow(/^traits: /)
    expect(() => validateTraitTable({ ...BEHAVIOR_TRAITS, calm: { idle: -1 } })).toThrow(
      /^traits: /,
    )
  })
})
