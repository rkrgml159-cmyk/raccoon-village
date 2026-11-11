import { describe, expect, it } from 'vitest'
import traitsJson from '../../../data/behavior/traits.json'
import { mulberry32 } from '@domain/rng'
import { validateTraitTable, type Trait } from '@domain/mind/Traits'
import type { Needs } from '@domain/mind/Needs'
import { createResident, type Resident } from '@domain/resident/Resident'
import { RIG_DEFAULT_PROFILE, REACH, type Profile } from '@domain/resident/UtilityAI'
import { CHASE_OFFSET, type Duet, type DuetType } from '@domain/social/Duets'
import { pairKey } from '@domain/social/Relations'
import {
  AVOID_MS,
  MAKEUP_WINDOW,
  MAX_DUETS,
  PAIR_COOLDOWN_MS,
  createVillageState,
  stepVillage,
  type SimEnv,
  type SimEvent,
  type VillageState,
} from '@domain/village/Simulation'

const table = validateTraitTable(traitsJson)
const SOCIAL: Profile = {
  walkSpeed: 0.06,
  weights: {
    default: { idle: 0.01, walk: 0.01, sit: 0.01, sleep: 0, approach: 5 },
    night: { idle: 0.01, walk: 0.01, sit: 0.01, sleep: 0, approach: 5 },
  },
  nocturnal: false,
}
const env = (o: Partial<SimEnv> = {}): SimEnv => ({
  phase: 'day',
  speed: 1,
  walkRangeOf: () => [0.05, 0.95],
  profileOf: () => RIG_DEFAULT_PROFILE,
  nocturnalOf: () => false,
  traitTable: table,
  ...o,
})
const socialEnv = (o: Partial<SimEnv> = {}): SimEnv => env({ profileOf: () => SOCIAL, ...o })

const mk = (residents: Resident[], seed = 1, traits: [Trait, Trait] = ['chatty', 'curious']) => {
  const s = createVillageState(residents, seed)
  for (const r of residents) s.minds[r.id].traits = traits
  return s
}
const setNeeds = (s: VillageState, id: string, n: Partial<Needs>): void => {
  s.minds[id].needs = { ...s.minds[id].needs, ...n }
}
const patch = (s: VillageState, id: string, p: Partial<Resident>): void => {
  s.residents = s.residents.map((r) => (r.id === id ? { ...r, ...p } : r))
}
const get = (s: VillageState, id: string): Resident => s.residents.find((r) => r.id === id)!
function run(
  s: VillageState,
  ms: number,
  e: SimEnv,
  rng: () => number,
  dt = 100,
  until?: (s: VillageState) => boolean,
) {
  let state = s
  const events: SimEvent[] = []
  for (let t = 0; t < ms; t += dt) {
    const r = stepVillage(state, dt, e, rng)
    state = r.state
    events.push(...r.events)
    if (until?.(state)) break
  }
  return { state, events }
}
const pair2 = (): Resident[] => [createResident('a', 0.3), createResident('b', 0.5)]
const approaching = (s: VillageState, a = 'a', b = 'b'): void =>
  patch(s, a, { state: 'approach', targetId: b, stateT: 20_000 })

/** A running duet of a given type, built directly. */
function withDuet(type: DuetType, durationMs: number, relation = 0.1) {
  const s = mk(pair2())
  s.relations.add('a', 'b', relation)
  s.met.add(pairKey('a', 'b'))
  const duet: Duet = { id: 'd0', type, a: 'a', b: 'b', t: 0, durationMs, step: 0, stepT: 0 }
  s.duets = [duet]
  for (const id of ['a', 'b']) patch(s, id, { state: 'duet', duetId: 'd0', stateT: durationMs })
  return s
}

describe('Simulation', () => {
  it('createVillageState is deterministic and gives each resident a mind', () => {
    const rs = pair2()
    const s1 = createVillageState(rs, 5)
    const s2 = createVillageState(rs, 5)
    expect(s1.minds).toEqual(s2.minds)
    expect(s1.minds.a.traits[0]).not.toBe(s1.minds.a.traits[1])
    expect(s1.simMs).toBe(0)
    expect(s1.nextDuetId).toBe(0)
    expect(s1.duets).toEqual([])
  })

  it('n=1 never approaches and never throws', () => {
    let s = mk([createResident('solo', 0.5)])
    const rng = mulberry32(2)
    const e = socialEnv()
    for (let t = 0; t < 600_000; t += 500) {
      const r = stepVillage(s, 500, e, rng)
      s = r.state
      expect(get(s, 'solo').state).not.toBe('approach')
      expect(s.duets).toHaveLength(0)
    }
  })

  it('needs rise with speed', () => {
    const s = mk([createResident('a', 0.5)])
    setNeeds(s, 'a', { bored: 0, hunger: 0 })
    patch(s, 'a', { stateT: 1e12 })
    const r = run(s, 90_000, env({ speed: 60 }), mulberry32(1), 1000)
    expect(r.state.minds.a.needs.bored).toBeCloseTo(1, 3)
    expect(r.state.minds.a.needs.hunger).toBeCloseTo(5_400_000 / 14_400_000, 3)
    expect(r.state.simMs).toBeCloseTo(5_400_000, 0)
  })

  it('glutton hungers faster and nocturnal sleepiness follows the day', () => {
    const s = mk([createResident('a', 0.5)])
    s.minds.a.traits = ['glutton', 'calm']
    setNeeds(s, 'a', { hunger: 0, sleepy: 0 })
    patch(s, 'a', { stateT: 1e12 })
    const r1 = stepVillage(s, 1_000_000, env(), mulberry32(1)).state
    expect(r1.minds.a.needs.hunger).toBeCloseTo((1_000_000 / 14_400_000) * 1.3, 6)
    expect(r1.minds.a.needs.sleepy).toBeCloseTo(1_000_000 / 28_800_000, 6)
    const day = stepVillage(s, 1_000_000, env({ nocturnalOf: () => true }), mulberry32(1)).state
    expect(day.minds.a.needs.sleepy).toBeCloseTo((1_000_000 / 28_800_000) * 1.5, 6)
    const night = stepVillage(
      s,
      1_000_000,
      env({ nocturnalOf: () => true, phase: 'night' }),
      mulberry32(1),
    ).state
    expect(night.minds.a.needs.sleepy).toBeCloseTo((1_000_000 / 28_800_000) * 0.5, 6)
    // nightowl flips a diurnal species
    s.minds.a.traits = ['nightowl', 'calm']
    const owl = stepVillage(s, 1_000_000, env(), mulberry32(1)).state
    expect(owl.minds.a.needs.sleepy).toBeCloseTo((1_000_000 / 28_800_000) * 1.5, 6)
    // dusk leaves the rate alone
    const dusk = stepVillage(s, 1_000_000, env({ phase: 'dusk' }), mulberry32(1)).state
    expect(dusk.minds.a.needs.sleepy).toBeCloseTo(1_000_000 / 28_800_000, 6)
  })

  it('uses night weights for nocturnal species by day', () => {
    // night profile forces 'sleep'; a nocturnal species sees "night" by day
    const sleepy: Profile = {
      walkSpeed: 0.06,
      weights: {
        default: { idle: 1, walk: 0, sit: 0, sleep: 0 },
        night: { idle: 0, walk: 0, sit: 0, sleep: 1 },
      },
      nocturnal: true,
    }
    const s = mk([createResident('a', 0.5)])
    patch(s, 'a', { stateT: 10 })
    const e = env({ profileOf: () => sleepy, nocturnalOf: () => true })
    const r = stepVillage(s, 100, e, () => 0.01)
    expect(get(r.state, 'a').state).toBe('sleep')
  })

  it('relieves needs when forage, sleep and walk end', () => {
    const s = mk(pair2())
    setNeeds(s, 'a', { hunger: 0.9, sleepy: 0, bored: 0 })
    setNeeds(s, 'b', { hunger: 0, sleepy: 0.9, bored: 0.5 })
    patch(s, 'a', { state: 'forage', stateT: 10 })
    patch(s, 'b', { state: 'sleep', stateT: 10 })
    const r = stepVillage(s, 100, env(), () => 0)
    expect(r.state.minds.a.needs.hunger).toBeCloseTo(0.3, 2)
    expect(r.state.minds.b.needs.sleepy).toBeLessThan(0.01)
    const w = mk(pair2())
    setNeeds(w, 'a', { bored: 0.5 })
    patch(w, 'a', { state: 'walk', targetX: 0.3005, x: 0.3, stateT: 10 })
    const r2 = stepVillage(w, 100, env(), () => 0)
    expect(get(r2.state, 'a').state).toBe('idle')
    expect(r2.state.minds.a.needs.bored).toBeCloseTo(0.4, 2)
    expect(r2.events).toContainEqual({ kind: 'state', id: 'a', state: 'idle' })
  })

  it('approach leads to a duet within reach', () => {
    const rs = [createResident('a', 0.3), createResident('b', 0.5)]
    const s = mk(rs)
    setNeeds(s, 'a', { lonely: 1 })
    setNeeds(s, 'b', { lonely: 1 })
    const r = run(s, 30_000, socialEnv(), mulberry32(3), 100, (st) => st.duets.length > 0)
    expect(r.state.duets).toHaveLength(1)
    expect(get(r.state, 'a').state).toBe('duet')
    expect(get(r.state, 'b').state).toBe('duet')
    expect(Math.abs(get(r.state, 'a').x - get(r.state, 'b').x)).toBeLessThanOrEqual(REACH + 1e-9)
    const start = r.events.find((e) => e.kind === 'duetStart')
    expect(start).toBeDefined()
    const d = r.state.duets[0]
    expect(get(r.state, d.a).duetId).toBe(d.id)
    expect(get(r.state, d.a).targetId).toBeUndefined()
    expect(get(r.state, d.a).stateT).toBeCloseTo(d.durationMs, -2)
    expect(r.state.met.has(pairKey('a', 'b'))).toBe(true)
  })

  it('an approach with no target available goes back to idle', () => {
    const s = mk(pair2())
    patch(s, 'b', { state: 'sleep', stateT: 1e9 })
    patch(s, 'a', { stateT: 10 })
    const r = stepVillage(s, 100, socialEnv(), () => 0.9999)
    const a = get(r.state, 'a')
    expect(a.state).toBe('idle')
    expect(a.targetId).toBeUndefined()
    expect(a.stateT).toBe(4000)
  })

  it('first duet is greet; outcome applies relation, needs, icons and events', () => {
    const s = mk(pair2())
    patch(s, 'b', { x: 0.32 })
    setNeeds(s, 'a', { lonely: 0.9 })
    setNeeds(s, 'b', { lonely: 0.9 })
    approaching(s)
    const r = run(s, 10_000, env(), mulberry32(4), 100, (st) => st.duetLog.length > 0)
    expect(r.state.duetLog[0].type).toBe('greet')
    expect(r.state.duetLog[0].a).toBe('a')
    expect(r.state.relations.get('a', 'b')).toBeCloseTo(0.05)
    expect(r.state.minds.a.needs.lonely).toBeCloseTo(0.7, 1)
    expect(r.state.minds.b.needs.lonely).toBeCloseTo(0.7, 1)
    expect(get(r.state, 'a').state).toBe('idle')
    expect(get(r.state, 'a').stateT).toBe(4000)
    expect(get(r.state, 'a').duetId).toBeUndefined()
    expect(r.state.duets).toHaveLength(0)
    expect(r.state.lastDuetAt[pairKey('a', 'b')]).toBe(r.state.simMs)
    const kinds = r.events.map((e) => e.kind)
    expect(kinds).toContain('duetStart')
    expect(kinds).toContain('duetStep')
    expect(kinds).toContain('duetEnd')
    const icons = r.events.filter((e) => e.kind === 'icon')
    expect(icons).toContainEqual({ kind: 'icon', id: 'a', icon: 'question' })
    expect(icons).toContainEqual({ kind: 'icon', id: 'b', icon: 'question' })
    const speaks = r.events.filter((e) => e.kind === 'speak')
    expect(speaks.length).toBeGreaterThanOrEqual(2)
    expect((speaks[0] as { id: string }).id).toBe('a')
    expect((speaks[1] as { id: string }).id).toBe('b')
  })

  it('orders events: duet, then state, then icon', () => {
    const s = withDuet('groom', 1000)
    setNeeds(s, 'a', { hunger: 0.79 })
    const r = stepVillage(s, 1500, env(), () => 0.5)
    const order = r.events.map((e) => e.kind)
    const rank = { duetStart: 0, duetStep: 0, speak: 0, duetEnd: 0, state: 1, icon: 2 } as const
    const ranks = order.map((k) => rank[k])
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y))
    expect(order).toContain('state')
    expect(order).toContain('icon')
  })

  it.each([
    ['greet', 0.1, []],
    ['chat', 0.1, []],
    ['sitTogether', 0.1, []],
    ['sitTogether', 0.3, ['a', 'b']],
    ['chase', 0.1, ['a', 'b']],
    ['share', 0.1, ['b']],
    ['groom', 0.1, ['a', 'b']],
    ['quarrel', 0.1, ['a', 'b']],
    ['makeUp', 0.1, ['a', 'b']],
  ] as const)('ending %s at relation %s shows icons on %j', (type, rel, who) => {
    const s = withDuet(type, 1000, rel)
    setNeeds(s, 'a', { bored: 0.5, lonely: 0.5, hunger: 0.5 })
    setNeeds(s, 'b', { bored: 0.5, lonely: 0.5, hunger: 0.5 })
    const r = stepVillage(s, 1100, env(), () => 0.5)
    expect(r.events.some((e) => e.kind === 'duetEnd')).toBe(true)
    const icon = {
      sitTogether: 'heart',
      chase: 'heart',
      share: 'leaf',
      groom: 'sparkle',
      quarrel: 'anger',
      makeUp: 'heart',
    } as Record<string, string>
    const shown = r.events.filter((e) => e.kind === 'icon') as { id: string; icon: string }[]
    expect(shown.map((e) => e.id)).toEqual([...who])
    for (const e of shown) expect(e.icon).toBe(icon[type])
  })

  it('applies need relief from outcomes (share feeds b)', () => {
    const s = withDuet('share', 1000)
    setNeeds(s, 'b', { hunger: 0.9 })
    const r = stepVillage(s, 1100, env(), () => 0.5)
    expect(r.state.minds.b.needs.hunger).toBeCloseTo(0.4, 1)
  })

  it('swaps roles so the hungrier one receives a share', () => {
    const s = mk(pair2(), 1, ['calm', 'tidy'])
    s.met.add(pairKey('a', 'b'))
    patch(s, 'b', { x: 0.31 })
    setNeeds(s, 'a', { hunger: 0.95, bored: 0.2, lonely: 0.2 })
    setNeeds(s, 'b', { hunger: 0.55, bored: 0.2, lonely: 0.2 })
    approaching(s)
    // greet(1) chat(.8) share(.4): the last option at rng ~ 1 is share (groom/chase/quarrel ineligible)
    const r = stepVillage(s, 50, env(), () => 0.99999)
    expect(r.state.duets[0].type).toBe('share')
    expect(r.state.duets[0].a).toBe('b')
    expect(r.state.duets[0].b).toBe('a')
  })

  it('max 3 concurrent duets', () => {
    const rs = Array.from({ length: 10 }, (_, i) => createResident(`r${i}`, 0.2 + i * 0.05))
    const s = mk(rs)
    for (const r of rs) setNeeds(s, r.id, { lonely: 1 })
    const rng = mulberry32(9)
    const e = socialEnv()
    let state = s
    let peak = 0
    for (let t = 0; t < 120_000; t += 100) {
      state = stepVillage(state, 100, e, rng).state
      peak = Math.max(peak, state.duets.length)
      expect(state.duets.length).toBeLessThanOrEqual(MAX_DUETS)
      const inDuet = state.residents.filter((r) => r.state === 'duet').length
      expect(inDuet).toBe(state.duets.length * 2)
    }
    expect(peak).toBe(MAX_DUETS)
  })

  it('does not start a duet when the cap is full or the target is busy', () => {
    const rs = [createResident('a', 0.5), createResident('b', 0.52), createResident('c', 0.9)]
    const s = mk(rs)
    s.duets = [1, 2, 3].map((i) => ({
      id: `x${i}`,
      type: 'chat' as const,
      a: `p${i}`,
      b: `q${i}`,
      t: 0,
      durationMs: 1e9,
      step: 0,
      stepT: 0,
    }))
    approaching(s)
    const r = stepVillage(s, 50, env(), mulberry32(1))
    expect(r.state.duets).toHaveLength(3)
    expect(get(r.state, 'a').state).toBe('idle')
    // target already in a duet
    const t = mk(rs)
    patch(t, 'b', { state: 'duet', duetId: 'zz', stateT: 1e9 })
    approaching(t)
    const r2 = stepVillage(t, 50, env(), mulberry32(1))
    expect(get(r2.state, 'a').state).toBe('idle')
  })

  it('pair cooldown 60 s', () => {
    const s = mk(pair2())
    const rng = mulberry32(11)
    for (const id of ['a', 'b']) setNeeds(s, id, { lonely: 1 })
    const r = run(s, 400_000, socialEnv(), rng, 200)
    const log = r.state.duetLog
    expect(log.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < log.length; i++) {
      expect(log[i].at - log[i - 1].at).toBeGreaterThanOrEqual(PAIR_COOLDOWN_MS)
    }
  })

  it('quarrel sets avoid and makeUp follows within the window', () => {
    const s = mk(pair2(), 1, ['calm', 'tidy'])
    s.met.add(pairKey('a', 'b'))
    patch(s, 'b', { x: 0.31 })
    for (const id of ['a', 'b']) setNeeds(s, id, { bored: 0.95, hunger: 0.1, lonely: 0.5 })
    approaching(s)
    const rng = (): number => 0.99999 // always the last eligible option: quarrel
    const e = socialEnv()
    const first = run(s, 30_000, e, rng, 100, (st) => st.duetLog.length > 0)
    expect(first.state.duetLog[0].type).toBe('quarrel')
    const key = pairKey('a', 'b')
    const endAt = first.state.realMs
    expect(first.state.avoidUntil[key]).toBe(endAt + AVOID_MS)
    expect(first.state.quarrelAt[key]).toBe(endAt)
    expect(first.state.relations.get('a', 'b')).toBeLessThan(0)
    const next = run(first.state, 400_000, e, rng, 100, (st) => st.duetLog.length > 1)
    const second = next.state.duetLog[1]
    expect(second.type).toBe('makeUp')
    expect(second.at - endAt).toBeGreaterThanOrEqual(MAKEUP_WINDOW[0])
    expect(second.at - endAt).toBeLessThanOrEqual(MAKEUP_WINDOW[1])
    expect(next.state.quarrelAt[key]).toBeUndefined()
  })

  it('chase moves b around a, clamped to the walk range', () => {
    const s = mk(pair2(), 1, ['calm', 'tidy'])
    s.met.add(pairKey('a', 'b'))
    patch(s, 'b', { x: 0.31 })
    for (const id of ['a', 'b']) setNeeds(s, id, { bored: 0.6, hunger: 0.1, lonely: 0.5 })
    approaching(s)
    const rng = (): number => 0.99999
    const started = stepVillage(s, 50, env(), rng).state
    expect(started.duets[0].type).toBe('chase')
    const a0 = get(started, 'a').x
    const r1 = run(started, 3100, env(), rng, 100, (st) => st.duets[0]?.step === 1)
    const a1 = get(r1.state, 'a').x
    const b1 = get(r1.state, 'b').x
    expect(b1).toBeCloseTo(a0, 6)
    expect(Math.abs(b1 - a1)).toBeCloseTo(CHASE_OFFSET, 5)
    const dir1 = Math.sign(b1 - a1)
    const r2 = run(r1.state, 3100, env(), rng, 100, (st) => (st.duets[0]?.step ?? 2) === 2)
    expect(Math.sign(get(r2.state, 'b').x - get(r2.state, 'a').x)).toBe(-dir1)
    const facing = get(r2.state, 'b').facing
    expect(['left', 'right']).toContain(facing)
    // narrow range: positions clamp
    const narrow = run(started, 3100, env({ walkRangeOf: () => [0.3, 0.35] }), rng)
    for (const id of ['a', 'b']) {
      expect(get(narrow.state, id).x).toBeGreaterThanOrEqual(0.3)
      expect(get(narrow.state, id).x).toBeLessThanOrEqual(0.35)
    }
  })

  it('speaks on each step for chat, alternating a and b', () => {
    const s = withDuet('chat', 14_000)
    const r = run(s, 6000, env(), () => 0.5)
    const speakers = r.events.filter((e) => e.kind === 'speak').map((e) => (e as { id: string }).id)
    expect(speakers).toEqual(['b', 'a'])
    const steps = r.events.filter((e) => e.kind === 'duetStep')
    expect(steps).toHaveLength(2)
    const quiet = withDuet('sitTogether', 30_000)
    const q = run(quiet, 21_000, env(), () => 0.5)
    expect(q.events.filter((e) => e.kind === 'speak')).toHaveLength(0)
    expect(q.events.filter((e) => e.kind === 'duetStep')).toHaveLength(1)
  })

  it('sleeping resident is not targeted', () => {
    const s = mk(pair2())
    patch(s, 'b', { state: 'sleep', stateT: 1e12 })
    setNeeds(s, 'a', { lonely: 1 })
    const r = run(s, 120_000, socialEnv(), mulberry32(6), 250)
    expect(r.state.duetLog).toHaveLength(0)
    expect(r.events.some((e) => e.kind === 'duetStart')).toBe(false)
  })

  it('resize mid-duet keeps both in duet and inside walkRange', () => {
    const s = withDuet('sitTogether', 30_000)
    patch(s, 'a', { x: 0.8 })
    patch(s, 'b', { x: 0.82 })
    const r = stepVillage(s, 100, env({ walkRangeOf: () => [0.4, 0.6] }), () => 0.5)
    for (const id of ['a', 'b']) {
      expect(get(r.state, id).state).toBe('duet')
      expect(get(r.state, id).x).toBeLessThanOrEqual(0.6)
      expect(get(r.state, id).x).toBeGreaterThanOrEqual(0.4)
    }
    expect(r.state.duets).toHaveLength(1)
  })

  it('deterministic for seed', () => {
    const go = () => {
      const rs = Array.from({ length: 6 }, (_, i) => createResident(`r${i}`, 0.2 + i * 0.1))
      const s = createVillageState(rs, 42)
      return run(s, 60_000, socialEnv(), mulberry32(8))
    }
    const a = go()
    const b = go()
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events))
    expect(JSON.stringify(a.state.residents)).toBe(JSON.stringify(b.state.residents))
    expect(a.state.relations.snapshot()).toEqual(b.state.relations.snapshot())
    expect(a.state.duetLog).toEqual(b.state.duetLog)
  })

  it('duetLog records types and is capped at 200', () => {
    const s = withDuet('chat', 500)
    s.duetLog = Array.from({ length: 200 }, (_, i) => ({
      type: 'greet' as const,
      a: `o${i}`,
      b: 'z',
      at: i,
    }))
    const r = stepVillage(s, 600, env(), () => 0.5)
    expect(r.state.duetLog).toHaveLength(200)
    expect(r.state.duetLog[0].a).toBe('o1')
    expect(r.state.duetLog[199]).toMatchObject({ type: 'chat', a: 'a', b: 'b' })
  })

  it('does not mutate its input', () => {
    const s = mk(pair2())
    patch(s, 'b', { x: 0.31 })
    approaching(s)
    const dump = (st: VillageState): string =>
      JSON.stringify({
        ...st,
        relations: st.relations.snapshot(),
        met: [...st.met],
        minds: Object.fromEntries(
          Object.entries(st.minds).map(([k, m]) => [k, { ...m, iconShown: [...m.iconShown] }]),
        ),
      })
    const before = dump(s)
    const rs = s.residents
    run(s, 8000, env(), mulberry32(2))
    expect(dump(s)).toBe(before)
    expect(s.residents).toBe(rs)
  })

  it('fires need icons once when a need crosses the threshold', () => {
    const s = mk([createResident('a', 0.5)])
    setNeeds(s, 'a', { bored: 0.79 })
    patch(s, 'a', { stateT: 1e12 })
    const r = stepVillage(s, 1_000_000, env(), () => 0.5)
    expect(r.events).toContainEqual({ kind: 'icon', id: 'a', icon: 'bored' })
    expect(r.state.minds.a.iconShown.has('bored')).toBe(true)
    const again = stepVillage(r.state, 1000, env(), () => 0.5)
    expect(again.events.filter((e) => e.kind === 'icon')).toHaveLength(0)
  })

  it('chase: b moves on every step and trails a; no swap near the edge', () => {
    const s0 = withDuet('chase', 30_000)
    patch(s0, 'a', { x: 0.85 })
    patch(s0, 'b', { x: 0.7 })
    let s = s0
    let prevB = get(s, 'b').x
    for (let step = 1; step <= 8; step++) {
      s = stepVillage(s, 3000, env(), () => 0.5).state
      const a = get(s, 'a').x
      const b = get(s, 'b').x
      const sign = step % 2 === 0 ? -1 : 1
      expect(Math.abs(b - prevB)).toBeGreaterThan(0.01)
      expect(sign * (a - b)).toBeGreaterThan(0)
      expect(a).toBeLessThanOrEqual(0.95)
      expect(b).toBeLessThanOrEqual(0.95)
      prevB = b
    }
  })

  it('chase in the open: both move CHASE_OFFSET per step', () => {
    let s = withDuet('chase', 30_000)
    patch(s, 'a', { x: 0.5 })
    patch(s, 'b', { x: 0.4 })
    const a0 = get(s, 'a').x
    s = stepVillage(s, 3000, env(), () => 0.5).state
    expect(get(s, 'b').x).toBeCloseTo(a0, 6)
    expect(get(s, 'a').x).toBeCloseTo(a0 + CHASE_OFFSET, 6)
    const a1 = get(s, 'a').x
    s = stepVillage(s, 3000, env(), () => 0.5).state
    expect(get(s, 'b').x).toBeCloseTo(a1, 6)
    expect(get(s, 'a').x).toBeCloseTo(a1 - CHASE_OFFSET, 6)
  })

  const only = (w: Partial<Record<'forage' | 'sleep', number>>): Profile => ({
    walkSpeed: 0.06,
    weights: {
      default: {
        idle: 0,
        walk: 0,
        sit: 0,
        sleep: w.sleep ?? 0,
        forage: w.forage ?? 0,
        approach: 0,
      },
      night: { idle: 0, walk: 0, sit: 0, sleep: w.sleep ?? 0, forage: w.forage ?? 0, approach: 0 },
    },
    nocturnal: false,
  })

  it('relief applies when forage rolls into forage', () => {
    const s = mk(pair2())
    setNeeds(s, 'a', { hunger: 0.9 })
    patch(s, 'a', { state: 'forage', stateT: 10 })
    const r = stepVillage(s, 100, env({ profileOf: () => only({ forage: 1 }) }), () => 0.5)
    expect(get(r.state, 'a').state).toBe('forage')
    expect(r.state.minds.a.needs.hunger).toBeCloseTo(0.3, 2)
  })

  it('relief applies when sleep rolls into sleep', () => {
    const s = mk(pair2())
    setNeeds(s, 'a', { sleepy: 0.9 })
    patch(s, 'a', { state: 'sleep', stateT: 10 })
    const r = stepVillage(s, 100, env({ profileOf: () => only({ sleep: 1 }) }), () => 0.5)
    expect(get(r.state, 'a').state).toBe('sleep')
    expect(r.state.minds.a.needs.sleepy).toBeLessThan(0.05)
  })

  it('no relief while forage is still running', () => {
    const s = mk(pair2())
    setNeeds(s, 'a', { hunger: 0.5 })
    patch(s, 'a', { state: 'forage', stateT: 5000 })
    const r = stepVillage(s, 100, env({ profileOf: () => only({ forage: 1 }) }), () => 0.5)
    expect(r.state.minds.a.needs.hunger).toBeGreaterThan(0.49)
  })

  it('pair cooldown holds at speed 60 (cooldown runs on sim time)', () => {
    const s = mk(pair2())
    for (const id of ['a', 'b']) setNeeds(s, id, { lonely: 1 })
    const r = run(s, 60_000, socialEnv({ speed: 60 }), mulberry32(11), 100)
    const log = r.state.duetLog
    expect(log.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < log.length; i++) {
      expect(log[i].at - log[i - 1].at).toBeGreaterThanOrEqual(PAIR_COOLDOWN_MS)
      // ~1 s of real time is enough at speed 60, far less than 60 s real
      expect((log[i].at - log[i - 1].at) / 60).toBeLessThan(60_000)
    }
  })

  it('quarrel avoidance runs on behaviour time at speed 600', () => {
    const s = mk(pair2(), 1, ['calm', 'tidy'])
    s.met.add(pairKey('a', 'b'))
    patch(s, 'b', { x: 0.31 })
    for (const id of ['a', 'b']) setNeeds(s, id, { bored: 0.95, hunger: 0.1, lonely: 0.5 })
    approaching(s)
    const r = run(
      s,
      30_000,
      socialEnv({ speed: 600 }),
      () => 0.99999,
      100,
      (st) => st.duetLog.length > 0,
    )
    const key = pairKey('a', 'b')
    expect(r.state.duetLog[0].type).toBe('quarrel')
    expect(r.state.avoidUntil[key]).toBe(r.state.realMs + AVOID_MS)
  })

  it('makeUp still follows a quarrel at speed 600', () => {
    const s = mk(pair2(), 1, ['calm', 'tidy'])
    s.met.add(pairKey('a', 'b'))
    patch(s, 'b', { x: 0.31 })
    for (const id of ['a', 'b']) setNeeds(s, id, { bored: 0.95, hunger: 0.1, lonely: 0.5 })
    approaching(s)
    const rng = (): number => 0.99999
    const e = socialEnv({ speed: 600 })
    const r = run(s, 400_000, e, rng, 100, (st) => st.duetLog.length > 1)
    expect(r.state.duetLog.map((d) => d.type)).toEqual(['quarrel', 'makeUp'])
  })
})
