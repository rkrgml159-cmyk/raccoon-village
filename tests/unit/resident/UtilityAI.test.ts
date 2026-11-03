import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import type { Phase } from '@domain/time/DateContext'
import { createResident } from '@domain/resident/Resident'
import { chooseNext, tick } from '@domain/resident/UtilityAI'

const ctx = { phase: 'day' as Phase, walkRange: [0.05, 0.95] as const }

describe('UtilityAI', () => {
  it('idle expires then transitions to a new state', () => {
    let r = createResident('a')
    const rng = mulberry32(1)
    r = tick(r, 6000, ctx, rng)
    expect(r.state).not.toBe(undefined)
    expect(r.stateT).toBeGreaterThan(0)
  })
  it('walk moves toward targetX at WALK_SPEED and faces the right way', () => {
    const r0 = {
      ...createResident('a', 0.5),
      state: 'walk' as const,
      targetX: 0.8,
      stateT: Infinity,
      facing: 'left' as const,
    }
    const r1 = tick(r0, 1000, ctx, () => 0.5)
    expect(r1.x).toBeCloseTo(0.56, 5)
    expect(r1.facing).toBe('right')
  })
  it('walk ends when target reached and never leaves walkRange', () => {
    const r0 = {
      ...createResident('a', 0.68),
      state: 'walk' as const,
      targetX: 0.7,
      stateT: Infinity,
    }
    const r1 = tick(r0, 1000, { ...ctx, walkRange: [0.3, 0.7] }, () => 0.5)
    expect(r1.x).toBeLessThanOrEqual(0.7)
    expect(r1.state).not.toBe('walk')
  })
  it('walk target is within ±0.1..0.4 and clamped to walkRange', () => {
    for (let i = 0; i < 200; i++) {
      const rng = mulberry32(i)
      let r = createResident('a', 0.5)
      r = { ...r, stateT: 0 }
      r = tick(r, 16, { ...ctx, walkRange: [0.3, 0.7] }, rng)
      if (r.state === 'walk') {
        expect(r.targetX!).toBeGreaterThanOrEqual(0.3)
        expect(r.targetX!).toBeLessThanOrEqual(0.7)
        expect(Math.abs(r.targetX! - 0.5)).toBeGreaterThanOrEqual(0.1 - 1e-9)
      }
    }
  })
  it('night weights: sit ≈ 20%, walk ≈ 5% over 10k samples', () => {
    const rng = mulberry32(3)
    const n = { idle: 0, walk: 0, sit: 0 }
    for (let i = 0; i < 10000; i++) n[chooseNext('idle', [], 'night', rng)]++
    expect(n.sit / 10000).toBeCloseTo(0.2, 1)
    expect(n.walk / 10000).toBeLessThan(0.08)
  })
  it('no state three times in a row except walk after walk is also forbidden', () => {
    const rng = mulberry32(9)
    for (let i = 0; i < 2000; i++) {
      const s = chooseNext('sit', ['sit', 'sit'], 'day', rng)
      expect(s).not.toBe('sit')
    }
  })
  it('walk never follows walk', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      expect(chooseNext('walk', ['idle', 'walk'], 'day', rng)).not.toBe('walk')
    }
  })
  it('durations within spec ranges', () => {
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(i)
      const r = tick({ ...createResident('a'), stateT: 0 }, 16, ctx, rng)
      if (r.state === 'idle') {
        expect(r.stateT).toBeGreaterThanOrEqual(4000)
        expect(r.stateT).toBeLessThanOrEqual(12000)
      }
      if (r.state === 'sit') {
        expect(r.stateT).toBeGreaterThanOrEqual(6000)
        expect(r.stateT).toBeLessThanOrEqual(20000)
      }
    }
  })
  it('deterministic for same seed', () => {
    const run = () => {
      let r = createResident('a')
      const rng = mulberry32(77)
      const out: string[] = []
      for (let i = 0; i < 100; i++) {
        r = tick(r, 500, ctx, rng)
        out.push(`${r.state}:${r.x.toFixed(3)}`)
      }
      return out
    }
    expect(run()).toEqual(run())
  })
  it('does not mutate its input and keeps history to 3', () => {
    const r0 = createResident('a')
    const snap = JSON.stringify(r0)
    let r = r0
    const rng = mulberry32(2)
    for (let i = 0; i < 200; i++) {
      r = tick(r, 3000, ctx, rng)
      expect(r.history.length).toBeLessThanOrEqual(3)
    }
    expect(JSON.stringify(r0)).toBe(snap)
  })
  it('flips direction at a range edge so walk is never zero distance', () => {
    for (let i = 0; i < 100; i++) {
      const r = tick(
        { ...createResident('a', 0.95), stateT: 0, state: 'sit' },
        16,
        ctx,
        mulberry32(i),
      )
      if (r.state === 'walk') expect(Math.abs(r.targetX! - 0.95)).toBeGreaterThanOrEqual(0.1 - 1e-9)
    }
  })
})
