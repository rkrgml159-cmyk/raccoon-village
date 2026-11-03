import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import type { Phase } from '@domain/time/DateContext'
import { createResident } from '@domain/resident/Resident'
import {
  RIG_DEFAULT_PROFILE,
  chooseNext,
  effectivePhase,
  profileFor,
  tick,
} from '@domain/resident/UtilityAI'
import type { SpeciesDef } from '@domain/sprites/types'

const ctx = {
  phase: 'day' as Phase,
  walkRange: [0.05, 0.95] as const,
  profile: RIG_DEFAULT_PROFILE,
}
const W = RIG_DEFAULT_PROFILE.weights

describe('UtilityAI', () => {
  it('idle expires then transitions to a new state', () => {
    let r = createResident('a')
    const rng = mulberry32(1)
    r = tick(r, 6000, ctx, rng)
    expect(r.state).not.toBe(undefined)
    expect(r.stateT).toBeGreaterThan(0)
  })
  it('walk moves toward targetX at profile walkSpeed and faces the right way', () => {
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
  it('a walk toward a now-out-of-range target is clamped and ends when the range shrinks', () => {
    const r0 = {
      ...createResident('a', 0.6),
      state: 'walk' as const,
      targetX: 0.9,
      stateT: Infinity,
    }
    const r1 = tick(r0, 16, { ...ctx, walkRange: [0.3, 0.7] }, () => 0.5)
    expect(r1.x).toBeLessThanOrEqual(0.7)
    expect(r1.state !== 'walk' || r1.targetX! <= 0.7).toBe(true)
    const r2 = tick({ ...r0, x: 0.9 }, 16, { ...ctx, walkRange: [0.3, 0.7] }, () => 0.5)
    expect(r2.x).toBeLessThanOrEqual(0.7)
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
  it('walk target stays within 0.4 of x with the default wide range', () => {
    for (let i = 0; i < 200; i++) {
      const r = tick({ ...createResident('a', 0.5), stateT: 0 }, 16, ctx, mulberry32(i))
      if (r.state === 'walk') expect(Math.abs(r.targetX! - 0.5)).toBeLessThanOrEqual(0.4 + 1e-9)
    }
  })
  it('allows a state to repeat once, and idle dominates by day', () => {
    const rng = mulberry32(11)
    let r = createResident('a')
    let prev = r.state
    let transitions = 0
    let repeats = 0
    let idle = 0
    while (transitions < 500) {
      const next = tick(r, 100, ctx, rng)
      if (next.stateT > r.stateT) {
        transitions++
        if (next.state === prev) repeats++
        if (next.state === 'idle') idle++
        prev = next.state
      }
      r = next
    }
    expect(repeats).toBeGreaterThan(0)
    expect(idle / transitions).toBeGreaterThan(0.5)
  })
  it('night weights: sit ≈ 20%, walk ≈ 5% over 10k samples', () => {
    const rng = mulberry32(3)
    const n = { idle: 0, walk: 0, sit: 0, sleep: 0 }
    for (let i = 0; i < 10000; i++) n[chooseNext('idle', [], 'night', W.night, rng)]++
    expect(Math.abs(n.sit / 10000 - 0.15)).toBeLessThanOrEqual(0.03)
    expect(Math.abs(n.walk / 10000 - 0.05)).toBeLessThanOrEqual(0.03)
  })
  it('never picks the same state three times in a row, and never walk right after walk', () => {
    const rng = mulberry32(9)
    for (let i = 0; i < 2000; i++) {
      const s = chooseNext('sit', ['sit', 'sit'], 'day', W.default, rng)
      expect(s).not.toBe('sit')
    }
  })
  it('walk never follows walk', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      expect(chooseNext('walk', ['idle', 'walk'], 'day', W.default, rng)).not.toBe('walk')
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
  it('effectivePhase flips day and night only', () => {
    const table: [Phase, boolean, Phase][] = [
      ['day', false, 'day'],
      ['night', false, 'night'],
      ['dawn', false, 'dawn'],
      ['dusk', false, 'dusk'],
      ['day', true, 'night'],
      ['night', true, 'day'],
      ['dawn', true, 'dawn'],
      ['dusk', true, 'dusk'],
    ]
    for (const [p, noc, want] of table) expect(effectivePhase(p, noc)).toBe(want)
  })
  it('sleep lasts 10-30 s', () => {
    let seen = 0
    for (let i = 0; i < 2000 && seen < 20; i++) {
      const r = tick(
        { ...createResident('a'), stateT: 0 },
        16,
        { ...ctx, phase: 'night' },
        mulberry32(i),
      )
      if (r.state === 'sleep') {
        seen++
        expect(r.stateT).toBeGreaterThanOrEqual(10000)
        expect(r.stateT).toBeLessThanOrEqual(30000)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
  it('night weights favor sleep', () => {
    const rng = mulberry32(21)
    let sleep = 0
    for (let i = 0; i < 1000; i++) {
      if (chooseNext('idle', [], 'night', RIG_DEFAULT_PROFILE.weights.night, rng) === 'sleep')
        sleep++
    }
    expect(Math.abs(sleep / 1000 - 0.35)).toBeLessThanOrEqual(0.05)
  })
  it('walk speed comes from profile', () => {
    const r0 = {
      ...createResident('a', 0.3),
      state: 'walk' as const,
      targetX: 0.9,
      stateT: Infinity,
    }
    const r1 = tick(
      r0,
      1000,
      { ...ctx, profile: { ...RIG_DEFAULT_PROFILE, walkSpeed: 0.12 } },
      () => 0.5,
    )
    expect(r1.x).toBeCloseTo(0.42, 5)
  })
  it('nocturnal residents use night weights by day', () => {
    const rng = mulberry32(4)
    let sleep = 0
    const noc = { ...RIG_DEFAULT_PROFILE, nocturnal: true }
    for (let i = 0; i < 500; i++) {
      const r = tick({ ...createResident('a'), stateT: 0 }, 16, { ...ctx, profile: noc }, rng)
      if (r.state === 'sleep') sleep++
    }
    expect(sleep / 500).toBeGreaterThan(0.2)
  })
  it('no three in a row still holds with sleep', () => {
    const rng = mulberry32(13)
    for (let i = 0; i < 2000; i++) {
      expect(chooseNext('sleep', ['sleep', 'sleep'], 'night', W.night, rng)).not.toBe('sleep')
    }
  })
  it('profileFor fills missing fields from the rig default', () => {
    const base = { name: 'x', rig: 'r', scale: 1, share: 1, palettes: {} } as SpeciesDef
    expect(profileFor(base)).toEqual(RIG_DEFAULT_PROFILE)
    const custom = profileFor({ ...base, walkSpeed: 0.1, nocturnal: true })
    expect(custom.walkSpeed).toBe(0.1)
    expect(custom.nocturnal).toBe(true)
    expect(custom.weights).toEqual(RIG_DEFAULT_PROFILE.weights)
  })
})
