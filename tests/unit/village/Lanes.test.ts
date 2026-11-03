import { describe, expect, it } from 'vitest'
import { clampX, toScreen, walkRangeFor } from '@domain/village/Lanes'

describe('Lanes', () => {
  it('maps lane 1 center to screen', () => {
    expect(toScreen(1, 0.5, { width: 1000, height: 500 })).toEqual({ px: 500, py: 360, scale: 1.0 })
  })
  it('clamps x', () => {
    expect(clampX(1.2)).toBe(0.95)
    expect(clampX(-1)).toBe(0.05)
    expect(clampX(0.5, [0.3, 0.7])).toBe(0.5)
    expect(clampX(0.9, [0.3, 0.7])).toBe(0.7)
  })
  it('lane 0 is smaller and higher than lane 2', () => {
    const a = toScreen(0, 0.5, { width: 100, height: 100 }),
      b = toScreen(2, 0.5, { width: 100, height: 100 })
    expect(a.scale).toBeLessThan(b.scale)
    expect(a.py).toBeLessThan(b.py)
  })
  it('walkRangeFor shrinks the visible range by the sprite half-width', () => {
    const r = walkRangeFor([0.25, 0.75], 0.067)
    expect(r[0]).toBeCloseTo(0.317, 3)
    expect(r[1]).toBeCloseTo(0.683, 3)
  })
  it('walkRangeFor never inverts: collapses to the centre', () => {
    expect(walkRangeFor([0.25, 0.75], 0.4)).toEqual([0.5, 0.5])
  })
})
