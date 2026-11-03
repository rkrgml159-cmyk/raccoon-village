import { describe, expect, it } from 'vitest'
import { showcaseLayout } from '@domain/village/Showcase'
import type { SpeciesDef } from '@domain/sprites/types'

function table(n: number): Record<string, SpeciesDef> {
  const out: Record<string, SpeciesDef> = {}
  for (let i = 0; i < n; i++) {
    out[`s${i}`] = {
      name: 'x',
      rig: 'r',
      // distinct scales, deliberately not in id order
      scale: 0.4 + ((i * 7) % n) * 0.05,
      share: 1,
      palettes: {},
    }
  }
  return out
}

describe('showcaseLayout', () => {
  const species = table(25)
  const layout = showcaseLayout(species)
  const scaleOf = (id: string): number => species[id].scale

  it('places every species exactly once', () => {
    expect(layout).toHaveLength(25)
    expect(new Set(layout.map((e) => e.id)).size).toBe(25)
  })

  it('puts the three largest in the back lane', () => {
    const back = layout.filter((e) => e.lane === 0).map((e) => scaleOf(e.id))
    expect(back).toHaveLength(3)
    const top3 = Object.values(species)
      .map((s) => s.scale)
      .sort((a, b) => b - a)
      .slice(0, 3)
    expect([...back].sort((a, b) => b - a)).toEqual(top3)
  })

  it('spaces each lane evenly inside the margins', () => {
    for (const lane of [0, 1, 2] as const) {
      const xs = layout
        .filter((e) => e.lane === lane)
        .map((e) => e.x)
        .sort((a, b) => a - b)
      expect(xs[0]).toBeCloseTo(0.08, 9)
      expect(xs[xs.length - 1]).toBeCloseTo(0.92, 9)
      for (let i = 1; i < xs.length; i++)
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(0.84 / (xs.length - 1) - 1e-9)
    }
  })

  it('does not put large neighbours side by side in lanes 1 and 2', () => {
    const sorted = Object.values(species)
      .map((s) => s.scale)
      .sort((a, b) => b - a)
    const limit = sorted[0] + sorted[1]
    for (const lane of [1, 2] as const) {
      const row = layout
        .filter((e) => e.lane === lane)
        .sort((a, b) => a.x - b.x)
        .map((e) => scaleOf(e.id))
      for (let i = 1; i < row.length; i++) expect(row[i] + row[i - 1]).toBeLessThan(limit)
    }
  })

  it('is deterministic', () => {
    expect(showcaseLayout(species)).toEqual(layout)
  })

  it('handles tiny tables', () => {
    expect(showcaseLayout({})).toEqual([])
    const one = showcaseLayout(table(1))
    expect(one).toHaveLength(1)
    expect(one[0].x).toBeCloseTo(0.5, 9)
  })
})
