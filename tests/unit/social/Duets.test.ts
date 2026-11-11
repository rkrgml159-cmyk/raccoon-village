import { describe, expect, it } from 'vitest'
import traitsJson from '../../../data/behavior/traits.json'
import {
  CHASE_OFFSET,
  DUET_RULES,
  DUET_TYPES,
  advanceDuet,
  chooseDuetType,
  startDuet,
  type DuetCtx,
  type DuetMind,
  type DuetType,
} from '@domain/social/Duets'
import { validateTraitTable, type Trait } from '@domain/mind/Traits'
import type { Band } from '@domain/social/Relations'

const table = validateTraitTable(traitsJson)
const calmNeeds = { hunger: 0.2, sleepy: 0.2, bored: 0.2, lonely: 0.2 }
const mind = (traits: Trait[] = [], needs: Partial<typeof calmNeeds> = {}): DuetMind => ({
  needs: { ...calmNeeds, ...needs },
  traits,
})
const ctx = (band: Band = 'neutral', extra: Partial<DuetCtx> = {}): DuetCtx => ({
  band,
  firstMeeting: false,
  quarrelWindow: false,
  table,
  ...extra,
})
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('Duets', () => {
  it('re-exports the type list', () => {
    expect(DUET_TYPES).toHaveLength(8)
    expect(CHASE_OFFSET).toBe(0.15)
  })

  it('first meeting is always greet', () => {
    const c = ctx('bestie', { firstMeeting: true, quarrelWindow: true })
    for (let i = 0; i < 20; i++) expect(chooseDuetType(mind(), mind(), c, seeded(i))).toBe('greet')
  })

  it('quarrel window prefers makeUp when band > awkward', () => {
    const c = ctx('neutral', { quarrelWindow: true })
    for (let i = 0; i < 20; i++) expect(chooseDuetType(mind(), mind(), c, seeded(i))).toBe('makeUp')
    const bad = ctx('awkward', { quarrelWindow: true })
    const picks = new Set<DuetType>()
    for (let i = 0; i < 50; i++) picks.add(chooseDuetType(mind(), mind(), bad, seeded(i)))
    expect(picks.has('makeUp')).toBe(false)
  })

  it('chat needs neutral band', () => {
    const e = DUET_RULES.chat.eligible
    expect(e(mind(), mind(), ctx('awkward'))).toBe(false)
    expect(e(mind(), mind(), ctx('neutral'))).toBe(true)
    expect(e(mind(), mind(), ctx('bestie'))).toBe(true)
  })

  it('sitTogether, groom need friend; chase needs both bored', () => {
    expect(DUET_RULES.sitTogether.eligible(mind(), mind(), ctx('neutral'))).toBe(false)
    expect(DUET_RULES.sitTogether.eligible(mind(), mind(), ctx('friend'))).toBe(true)
    expect(DUET_RULES.groom.eligible(mind(), mind(), ctx('neutral'))).toBe(false)
    expect(DUET_RULES.groom.eligible(mind(), mind(), ctx('bestie'))).toBe(true)
    const bored = mind([], { bored: 0.5 })
    expect(DUET_RULES.chase.eligible(bored, bored, ctx())).toBe(true)
    expect(DUET_RULES.chase.eligible(bored, mind(), ctx())).toBe(false)
    expect(DUET_RULES.greet.eligible(mind(), mind(), ctx('awkward'))).toBe(true)
  })

  it('share needs hungry b and non-glutton a', () => {
    const hungry = mind([], { hunger: 0.5 })
    const e = DUET_RULES.share.eligible
    expect(e(mind(), hungry, ctx())).toBe(true)
    expect(e(mind(), mind(), ctx())).toBe(false)
    expect(e(mind(['glutton']), hungry, ctx())).toBe(false)
  })

  it('quarrel needs both bored >= 0.7 and band <= neutral', () => {
    const bored = mind([], { bored: 0.7 })
    const e = DUET_RULES.quarrel.eligible
    expect(e(bored, bored, ctx('neutral'))).toBe(true)
    expect(e(bored, bored, ctx('awkward'))).toBe(true)
    expect(e(bored, bored, ctx('friend'))).toBe(false)
    expect(e(bored, mind([], { bored: 0.69 }), ctx('neutral'))).toBe(false)
  })

  it('quarrel stays rare but reachable for bored neutral pairs (base tuned 0.08 -> 0.25)', () => {
    const bored = { bored: 0.9, hunger: 0.2 }
    const rng = seeded(3)
    const n = 4000
    let q = 0
    for (let i = 0; i < n; i++) {
      if (
        chooseDuetType(mind(['curious'], bored), mind(['dreamer'], bored), ctx(), rng) === 'quarrel'
      )
        q++
    }
    // greet 1.0 + chat 0.8 + chase 0.4 + quarrel 0.25 -> ~10 %
    expect(q / n).toBeGreaterThan(0.07)
    expect(q / n).toBeLessThan(0.14)
  })

  it('makeUp eligibility', () => {
    const e = DUET_RULES.makeUp.eligible
    expect(e(mind(), mind(), ctx('neutral', { quarrelWindow: true }))).toBe(true)
    expect(e(mind(), mind(), ctx('awkward', { quarrelWindow: true }))).toBe(false)
    expect(e(mind(), mind(), ctx('neutral'))).toBe(false)
  })

  it('falls back to greet when nothing is eligible', () => {
    const c = ctx('awkward')
    expect(chooseDuetType(mind(), mind(), c, () => 0.99)).toBe('greet')
  })

  it('weights respect trait and band multipliers', () => {
    const rng = seeded(7)
    let chat = 0
    const n = 1000
    for (let i = 0; i < n; i++) {
      if (chooseDuetType(mind(['chatty']), mind(['chatty']), ctx('friend'), rng) === 'chat') chat++
    }
    expect(chat / n).toBeGreaterThan(0.4)
  })

  it('durations in range', () => {
    for (const type of DUET_TYPES) {
      const [lo, hi] = DUET_RULES[type].duration
      for (const r of [0, 0.5, 0.999]) {
        const d = startDuet('d1', type, 'x', 'y', () => r)
        expect(d.durationMs).toBeGreaterThanOrEqual(lo)
        expect(d.durationMs).toBeLessThanOrEqual(hi)
        expect(d).toMatchObject({ id: 'd1', type, a: 'x', b: 'y', t: 0, step: 0, stepT: 0 })
      }
    }
    expect(DUET_RULES.chat.duration).toEqual([8000, 14000])
    expect(DUET_RULES.greet.stepMs).toBe(1500)
  })

  it('advanceDuet steps and finishes', () => {
    const d = startDuet('d', 'greet', 'a', 'b', () => 0)
    const r1 = advanceDuet(d, 1600)
    expect(r1.finished).toBe(false)
    expect(r1.duet).toMatchObject({ t: 1600, step: 1, stepT: 100 })
    expect(d.t).toBe(0)
    const r2 = advanceDuet(r1.duet, 1400)
    expect(r2.finished).toBe(true)
    expect(r2.duet.step).toBe(2)
  })

  it('outcome values match table', () => {
    const a = mind()
    const b = mind()
    const o = (t: DuetType) => DUET_RULES[t].outcome(a, b)
    expect(o('greet')).toEqual({ relation: 0.05, a: { lonely: 0.2 }, b: { lonely: 0.2 } })
    expect(o('chat')).toEqual({ relation: 0.1, a: { bored: 0.4 }, b: { bored: 0.4 } })
    expect(o('sitTogether')).toEqual({ relation: 0.08, a: { lonely: 0.6 }, b: { lonely: 0.6 } })
    expect(o('chase')).toEqual({ relation: 0.12, a: { bored: 0.8 }, b: { bored: 0.8 } })
    expect(o('share')).toEqual({ relation: 0.15, a: {}, b: { hunger: 0.5 } })
    expect(o('groom')).toEqual({ relation: 0.1, a: { lonely: 0.4 }, b: { lonely: 0.4 } })
    expect(o('quarrel')).toEqual({ relation: -0.15, a: { bored: 0.3 }, b: { bored: 0.3 } })
    expect(o('makeUp')).toEqual({ relation: 0.2, a: {}, b: {} })
    expect(DUET_RULES.quarrel.outcome(a, mind(['timid'])).b).toEqual({ bored: 0.3, lonely: -0.2 })
  })
})
