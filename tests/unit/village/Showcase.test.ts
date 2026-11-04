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
      voice: { syllables: ['aa', 'bb'], marks: ['?', '…', '!'], maxSyllables: 2 },
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
    for (const lane of [0, 2] as const) {
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

  it('insets lane 1 by half a lane-2 step', () => {
    const xs = (lane: number): number[] =>
      layout
        .filter((e) => e.lane === lane)
        .map((e) => e.x)
        .sort((a, b) => a - b)
    const l2 = xs(2)
    const step = l2[1] - l2[0]
    const l1 = xs(1)
    expect(l1[0]).toBeCloseTo(0.08 + step / 2, 9)
    expect(l1[l1.length - 1]).toBeLessThanOrEqual(0.92 - step / 2 + 1e-9)
    for (let i = 1; i < l1.length; i++) expect(l1[i] - l1[i - 1]).toBeCloseTo(step, 9)
  })

  it('no two species in lanes 1 and 2 share an x column within 0.02', () => {
    const a = layout.filter((e) => e.lane === 1)
    const b = layout.filter((e) => e.lane === 2)
    for (const p of a) for (const q of b) expect(Math.abs(p.x - q.x)).toBeGreaterThan(0.02)
  })

  it('adjacent lanes alternate size at matching columns', () => {
    const front = layout.filter((e) => e.lane !== 0)
    const sorted = front.map((e) => scaleOf(e.id)).sort((x, y) => x - y)
    const median = (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2
    const big = (id: string): boolean => scaleOf(id) > median
    const l2 = layout.filter((e) => e.lane === 2).sort((p, q) => p.x - q.x)
    for (const p of layout.filter((e) => e.lane === 1)) {
      let near = l2[0]
      for (const q of l2) if (Math.abs(q.x - p.x) < Math.abs(near.x - p.x) - 1e-9) near = q
      expect(big(near.id)).toBe(!big(p.id))
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

  it('handles odd counts', () => {
    for (const n of [2, 3, 4, 6, 7, 24]) {
      const l = showcaseLayout(table(n))
      expect(new Set(l.map((e) => e.id)).size).toBe(n)
      for (const e of l) expect(e.x).toBeGreaterThanOrEqual(0.08 - 1e-9)
    }
  })

  it('handles tiny tables', () => {
    expect(showcaseLayout({})).toEqual([])
    const one = showcaseLayout(table(1))
    expect(one).toHaveLength(1)
    expect(one[0].x).toBeCloseTo(0.5, 9)
  })
})
