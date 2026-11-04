import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import type { Phase } from '@domain/time/DateContext'
import { createResident, spriteStateOf, type Resident } from '@domain/resident/Resident'
import {
  RIG_DEFAULT_PROFILE,
  chooseNext,
  effectivePhase,
  profileFor,
  tick,
  REACH,
  DURATION_MS,
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
    const n = { idle: 0, walk: 0, sit: 0, sleep: 0 } as Record<string, number>
    for (let i = 0; i < 10000; i++) n[chooseNext('idle', [], W.night, rng, false)]++
    expect(Math.abs(n.sit / 10000 - 0.15)).toBeLessThanOrEqual(0.03)
    expect(Math.abs(n.walk / 10000 - 0.05)).toBeLessThanOrEqual(0.03)
  })
  it('never picks the same state three times in a row, and never walk right after walk', () => {
    const rng = mulberry32(9)
    for (let i = 0; i < 2000; i++) {
      const s = chooseNext('sit', ['sit', 'sit'], W.default, rng)
      expect(s).not.toBe('sit')
    }
  })
  it('walk never follows walk', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      expect(chooseNext('walk', ['idle', 'walk'], W.default, rng)).not.toBe('walk')
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
      if (chooseNext('idle', [], RIG_DEFAULT_PROFILE.weights.night, rng) === 'sleep') sleep++
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
      expect(chooseNext('sleep', ['sleep', 'sleep'], W.night, rng)).not.toBe('sleep')
    }
  })
  it('profileFor fills missing fields from the rig default', () => {
    const base: SpeciesDef = {
      name: 'x',
      rig: 'r',
      scale: 1,
      share: 1,
      voice: { syllables: ['aa', 'bb'], marks: ['?', '…', '!'], maxSyllables: 2 },
      palettes: {},
    }
    expect(profileFor(base)).toEqual(RIG_DEFAULT_PROFILE)
    const custom = profileFor({ ...base, walkSpeed: 0.1, nocturnal: true })
    expect(custom.walkSpeed).toBe(0.1)
    expect(custom.nocturnal).toBe(true)
    expect(custom.weights).toEqual(RIG_DEFAULT_PROFILE.weights)
  })

  describe('forage / approach / duet', () => {
    const base = createResident('a', 0.2)
    const aCtx = { ...ctx, targetXOf: (id: string) => (id === 'b' ? 0.5 : undefined) }
    const prof = { ...RIG_DEFAULT_PROFILE, walkSpeed: 0.1 }

    it('approach moves toward target and stops within REACH', () => {
      let r: Resident = { ...base, state: 'approach', targetId: 'b', stateT: 20000 }
      const c = { ...aCtx, profile: prof }
      for (let i = 0; i < 31; i++) r = tick(r, 100, c, () => 0.5)
      expect(r.state).toBe('approach')
      expect(r.stateT).toBeLessThanOrEqual(0)
      expect(Math.abs(r.x - 0.5)).toBeLessThanOrEqual(REACH)
      expect(r.facing).toBe('right')
    })
    it('approach faces left when target is behind', () => {
      const r0 = { ...base, x: 0.9, state: 'approach' as const, targetId: 'b', stateT: 20000 }
      expect(tick(r0, 100, { ...aCtx, profile: prof }, () => 0.5).facing).toBe('left')
    })
    it('approach expires after 20 s if target unreachable', () => {
      const slow = { ...aCtx, profile: { ...prof, walkSpeed: 0.001 } }
      let r: Resident = { ...base, state: 'approach', targetId: 'b', stateT: 20000 }
      for (let i = 0; i < 20; i++) r = tick(r, 1000, slow, () => 0.5)
      expect(r.state).not.toBe('approach')
    })
    it('approach without targetXOf falls back to idle', () => {
      const r0 = { ...base, state: 'approach' as const, targetId: 'b', stateT: 20000 }
      expect(tick(r0, 100, ctx, () => 0.5).state).toBe('idle')
    })
    it('approach with vanished target falls back to idle', () => {
      const r0 = { ...base, state: 'approach' as const, targetId: 'zz', stateT: 20000 }
      const r1 = tick(r0, 100, aCtx, () => 0.5)
      expect(r1.state).toBe('idle')
      expect(r1.stateT).toBe(4000)
    })
    it('forage lasts 6-12 s', () => {
      expect(DURATION_MS.forage).toEqual([6000, 12000])
      const fCtx = {
        ...ctx,
        weights: { ...W.default, forage: 1, idle: 0, walk: 0, sit: 0, sleep: 0, approach: 0 },
      }
      const r = tick({ ...base, state: 'idle' as const, stateT: 1 }, 10, fCtx, () => 0.5)
      expect(r.state).toBe('forage')
      expect(r.stateT).toBeGreaterThanOrEqual(6000)
      expect(r.stateT).toBeLessThanOrEqual(12000)
    })
    it('forage expiry moves on', () => {
      const r = tick({ ...base, state: 'forage' as const, stateT: 5 }, 10, ctx, () => 0.5)
      expect(r.stateT).toBeGreaterThan(0)
    })
    it('duet state is untouched by tick', () => {
      const r0 = { ...base, state: 'duet' as const, stateT: 100, duetId: 'b' }
      expect(tick(r0, 5000, aCtx, () => 0.5)).toBe(r0)
    })
    it('history never contains duet or approach', () => {
      for (const st of ['approach', 'duet'] as const) {
        const r0 = { ...base, state: st, targetId: 'b', stateT: 1, history: [] }
        const out = st === 'duet' ? r0 : tick(r0, 10, ctx, () => 0.5)
        expect(out.history).not.toContain('duet')
        expect(out.history).not.toContain('approach')
      }
    })
    it('chooseNext never yields duet; approach only when allowed', () => {
      const full = { ...W.default, forage: 0.1, approach: 5 }
      for (let i = 0; i < 100; i++) {
        const rng = mulberry32(i)
        const n = chooseNext('idle', [], full, rng, false)
        expect(['duet', 'approach']).not.toContain(n)
      }
      let sawApproach = false
      for (let i = 0; i < 100; i++)
        if (chooseNext('idle', [], full, mulberry32(i)) === 'approach') sawApproach = true
      expect(sawApproach).toBe(true)
    })
    it('ctx.weights overrides profile weights', () => {
      const w = { idle: 0, walk: 0, sit: 1, sleep: 0, forage: 0, approach: 0 }
      const r = tick({ ...base, stateT: 1 }, 10, { ...ctx, weights: w }, () => 0.5)
      expect(r.state).toBe('sit')
    })
    it('approach chosen via startState sets 20 s timer', () => {
      const w = { idle: 0, walk: 0, sit: 0, sleep: 0, forage: 0, approach: 1 }
      const r = tick({ ...base, stateT: 1 }, 10, { ...aCtx, weights: w }, () => 0.5)
      expect(r.state).toBe('approach')
      expect(r.stateT).toBe(20000)
    })
  })

  it('spriteStateOf maps new states to existing poses', () => {
    expect(spriteStateOf('approach')).toBe('walk')
    expect(spriteStateOf('forage')).toBe('idle')
    expect(spriteStateOf('duet')).toBe('idle')
    expect(spriteStateOf('sit')).toBe('sit')
  })
})
