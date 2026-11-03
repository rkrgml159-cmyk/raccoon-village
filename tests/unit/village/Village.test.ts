import { describe, expect, it } from 'vitest'
import { createVillage, type VillageInput } from '@domain/village/Village'
import type { SpeciesDef } from '@domain/sprites/types'

const sp = (over: Partial<SpeciesDef> = {}): SpeciesDef => ({
  name: 'x',
  rig: 'r',
  scale: 1,
  share: 1,
  palettes: {},
  ...over,
})

const species: Record<string, SpeciesDef> = {
  raccoon: sp({ share: 0, scale: 1 }),
  fox: sp({ share: 3, scale: 0.9 }),
  hare: sp({ share: 2, scale: 0.7, lanes: [0, 0, 1] }),
  human: sp({ share: 1, scale: 1.5 }),
  ghost: sp({ share: 0 }),
}

const input = (over: Partial<VillageInput> = {}): VillageInput => ({
  seed: 1,
  n: 12,
  species,
  variantsOf: (id) => [`${id}-a`, `${id}-b`, `${id}-c`],
  bodyScaleOf: () => 1,
  ...over,
})

describe('createVillage', () => {
  it('keeps at least 60% raccoons', () => {
    const v = createVillage(input())
    expect(v).toHaveLength(12)
    expect(v.filter((r) => r.species === 'raccoon').length).toBeGreaterThanOrEqual(8)
  })
  it('is deterministic for the same seed', () => {
    expect(JSON.stringify(createVillage(input()))).toBe(JSON.stringify(createVillage(input())))
  })
  it('differs for another seed', () => {
    expect(JSON.stringify(createVillage(input()))).not.toBe(
      JSON.stringify(createVillage(input({ seed: 2 }))),
    )
  })
  it('never exceeds two humans', () => {
    const only = { raccoon: species.raccoon, human: sp({ share: 100 }), fox: sp({ share: 1 }) }
    for (let seed = 0; seed < 20; seed++) {
      const v = createVillage(input({ seed, n: 40, species: only }))
      expect(v.filter((r) => r.species === 'human').length).toBeLessThanOrEqual(2)
      expect(v).toHaveLength(40)
    }
  })
  it('respects minimum spacing per lane', () => {
    for (let seed = 0; seed < 20; seed++) {
      const v = createVillage(input({ seed, n: 30 }))
      for (const lane of [0, 1, 2]) {
        const xs = v
          .filter((r) => r.lane === lane)
          .map((r) => r.x)
          .sort((a, b) => a - b)
        for (let i = 1; i < xs.length; i++)
          expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(0.05 - 1e-9)
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(0.05 - 1e-9)
          expect(x).toBeLessThanOrEqual(0.95 + 1e-9)
        }
      }
    }
  })
  it('uses variantsOf and bodyScaleOf', () => {
    const v = createVillage(input({ bodyScaleOf: () => 1.1 }))
    for (const r of v) {
      expect(r.variant).toMatch(new RegExp(`^${r.species}-[abc]$`))
      expect(r.scale).toBeCloseTo(species[r.species].scale * 1.1, 9)
    }
  })
  it('excludes share 0 species other than raccoon', () => {
    for (let seed = 0; seed < 10; seed++) {
      const v = createVillage(input({ seed, n: 30 }))
      expect(v.some((r) => r.species === 'ghost')).toBe(false)
      expect(v.every((r) => ['raccoon', 'fox', 'hare', 'human'].includes(r.species))).toBe(true)
    }
  })
  it('numbers ids per species and starts idle', () => {
    const v = createVillage(input())
    expect(v.filter((r) => r.species === 'raccoon').map((r) => r.id)).toContain('raccoon-1')
    expect(new Set(v.map((r) => r.id)).size).toBe(v.length)
    for (const r of v) {
      expect(r.state).toBe('idle')
      expect(r.stateT).toBe(6000)
      expect(r.history).toEqual([])
    }
  })
  it('honours lane probabilities', () => {
    const v = createVillage(
      input({ n: 40, species: { raccoon: species.raccoon, hare: species.hare } }),
    )
    for (const r of v.filter((x) => x.species === 'hare')) expect(r.lane).toBe(2)
  })
  it('handles a village without other species', () => {
    const v = createVillage(input({ n: 5, species: { raccoon: species.raccoon } }))
    expect(v).toHaveLength(5)
    expect(v.every((r) => r.species === 'raccoon')).toBe(true)
  })
  it('keeps every x within [0.05, 0.95] and evenly spaced when one lane is crowded', () => {
    const crowded = {
      raccoon: sp({ share: 0, lanes: [0, 0, 1] }),
      hare: sp({ share: 100, lanes: [0, 0, 1] }),
    }
    for (let seed = 0; seed < 10; seed++) {
      const v = createVillage(input({ seed, n: 40, species: crowded }))
      const xs = v.map((r) => r.x).sort((a, b) => a - b)
      expect(v.every((r) => r.lane === 2)).toBe(true)
      const gap = Math.min(0.05, 0.9 / (xs.length - 1))
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(0.05 - 1e-9)
        expect(x).toBeLessThanOrEqual(0.95 + 1e-9)
      }
      for (let i = 1; i < xs.length; i++)
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(gap - 1e-9)
    }
  })
  it('rejects a negative or non-integer n', () => {
    expect(() => createVillage(input({ n: -1 }))).toThrow('n must be a non-negative integer')
    expect(() => createVillage(input({ n: 2.5 }))).toThrow('n must be a non-negative integer')
    expect(createVillage(input({ n: 0 }))).toEqual([])
  })
})
