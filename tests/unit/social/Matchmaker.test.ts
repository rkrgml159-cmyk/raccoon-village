import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@domain/rng'
import { REACH } from '@domain/resident/UtilityAI'
import { inReach, pickTarget, type Candidate } from '@domain/social/Matchmaker'

const c = (id: string, x: number, o: Partial<Candidate> = {}): Candidate => ({
  id,
  lane: 1,
  x,
  state: 'idle',
  ...o,
})
const self = c('self', 0.5)
const none = (): number => 0
const free = (): boolean => false

describe('Matchmaker', () => {
  it('prefers near friends', () => {
    const rng = mulberry32(7)
    const others = [c('near', 0.55), c('far', 0.9), c('friend', 0.8)]
    const rel = (id: string): number => (id === 'friend' ? 0.9 : 0)
    const counts: Record<string, number> = { near: 0, far: 0, friend: 0 }
    for (let i = 0; i < 1000; i++) counts[pickTarget(self, others, rel, free, rng)!]++
    expect(counts.near).toBeGreaterThan(counts.friend)
    expect(counts.friend).toBeGreaterThan(counts.far)
    const friendNear = [c('a', 0.6), c('b', 0.6)]
    const rel2 = (id: string): number => (id === 'b' ? 1 : 0)
    let b = 0
    for (let i = 0; i < 1000; i++) if (pickTarget(self, friendNear, rel2, free, rng) === 'b') b++
    expect(b).toBeGreaterThan(600)
  })

  it('excludes other lanes, duet, sleep, approach, blocked and self', () => {
    const others = [
      self,
      c('lane', 0.5, { lane: 2 }),
      c('duet', 0.5, { state: 'duet' }),
      c('sleep', 0.5, { state: 'sleep' }),
      c('appr', 0.5, { state: 'approach' }),
      c('blocked', 0.5),
      c('ok', 0.9, { state: 'walk' }),
    ]
    const rng = mulberry32(3)
    for (let i = 0; i < 50; i++) {
      expect(pickTarget(self, others, none, (id) => id === 'blocked', rng)).toBe('ok')
    }
  })

  it('undefined when none', () => {
    expect(pickTarget(self, [], none, free, () => 0.5)).toBeUndefined()
    expect(
      pickTarget(self, [c('x', 0.6, { state: 'sleep' })], none, free, () => 0.5),
    ).toBeUndefined()
    // an enemy at relation -1 has zero weight
    expect(
      pickTarget(
        self,
        [c('x', 0.6)],
        () => -1,
        free,
        () => 0.5,
      ),
    ).toBeUndefined()
  })

  it('falls back to the last candidate at rng ~ 1', () => {
    expect(pickTarget(self, [c('a', 0.6), c('b', 0.7)], none, free, () => 0.999999999)).toBe('b')
  })

  it('inReach', () => {
    expect(inReach(0.5, 0.5 + REACH * 0.99)).toBe(true)
    expect(inReach(0.5, 0.5 - REACH - 0.001)).toBe(false)
  })
})
