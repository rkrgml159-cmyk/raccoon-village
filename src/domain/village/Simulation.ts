import {
  advanceNeeds,
  initialNeeds,
  needIcons,
  relieve,
  type NeedKey,
  type Needs,
} from '../mind/Needs'
import { assignTraits, traitMultiplier, type Trait, type TraitTable } from '../mind/Traits'
import { composeWeights } from '../mind/Weights'
import { mulberry32 } from '../rng'
import type { Resident, ResidentState } from '../resident/Resident'
import { effectivePhase, tick, type AIContext, type Profile } from '../resident/UtilityAI'
import { inReach, pickTarget, type Candidate } from '../social/Matchmaker'
import {
  CHASE_OFFSET,
  DUET_RULES,
  advanceDuet,
  chooseDuetType,
  startDuet,
  type Duet,
  type DuetCtx,
  type DuetType,
} from '../social/Duets'
import { RelationTable, bandOf, pairKey } from '../social/Relations'
import type { Phase } from '../time/DateContext'
import { clampX } from './Lanes'

export interface Mind {
  needs: Needs
  traits: [Trait, Trait]
  iconShown: Set<NeedKey>
}

export interface VillageState {
  residents: Resident[]
  minds: Record<string, Mind>
  relations: RelationTable
  duets: Duet[]
  /** pairKey -> simMs the last duet of the pair ended (pacing follows the village clock). */
  lastDuetAt: Record<string, number>
  /** pairKey -> realMs until which the pair avoids each other. */
  avoidUntil: Record<string, number>
  /** pairKey -> realMs of the last unresolved quarrel. */
  quarrelAt: Record<string, number>
  met: Set<string>
  /** Sim clock (dtMs * speed): needs, relation decay, duetLog.at. */
  simMs: number
  /**
   * Behaviour clock (sum of dtMs): movement, duets, quarrel avoidance and the makeUp window run
   * on it, so a 1-5 min window stays reachable by walking residents at any speed (in sim time,
   * speed 600 shrank it to 0.1-0.5 s real).
   */
  realMs: number
  nextDuetId: number
  duetLog: { type: DuetType; a: string; b: string; at: number }[]
}

export interface SimEnv {
  phase: Phase
  speed: number
  walkRangeOf: (id: string) => readonly [number, number]
  profileOf: (species: string) => Profile
  nocturnalOf: (species: string) => boolean
  traitTable: TraitTable
}

export type IconKind = NeedKey | 'heart' | 'anger' | 'sparkle' | 'leaf' | 'question'

export type SimEvent =
  | { kind: 'state'; id: string; state: ResidentState }
  | { kind: 'duetStart'; duet: Duet }
  | { kind: 'duetStep'; duet: Duet }
  | { kind: 'duetEnd'; duet: Duet }
  | { kind: 'icon'; id: string; icon: IconKind }
  | { kind: 'speak'; id: string; duet: Duet }

export const MAX_DUETS = 3
export const PAIR_COOLDOWN_MS = 60_000
export const AVOID_MS = 30_000
export const MAKEUP_WINDOW: [number, number] = [60_000, 300_000]
export const DUET_LOG_CAP = 200

const IDLE_AFTER_MS = 4000
const SPEAKING: readonly DuetType[] = ['greet', 'chat', 'groom', 'makeUp']
const RELIEF_ON_LEAVE: Partial<Record<ResidentState, Partial<Needs>>> = {
  forage: { hunger: 0.6 },
  sleep: { sleepy: 1 },
  walk: { bored: 0.1 },
}

export function createVillageState(residents: Resident[], seed: number): VillageState {
  const rng = mulberry32(seed ^ 0x5151)
  const minds: Record<string, Mind> = {}
  for (const r of residents) {
    const needs = initialNeeds(rng)
    const traits = assignTraits(rng)
    minds[r.id] = { needs, traits, iconShown: new Set() }
  }
  return {
    residents: residents.map((r) => ({ ...r, history: [...r.history] })),
    minds,
    relations: new RelationTable(),
    duets: [],
    lastDuetAt: {},
    avoidUntil: {},
    quarrelAt: {},
    met: new Set(),
    simMs: 0,
    realMs: 0,
    nextDuetId: 0,
    duetLog: [],
  }
}

function cloneState(s: VillageState): VillageState {
  const minds: Record<string, Mind> = {}
  for (const [id, m] of Object.entries(s.minds)) {
    minds[id] = { needs: { ...m.needs }, traits: m.traits, iconShown: new Set(m.iconShown) }
  }
  return {
    residents: s.residents.map((r) => ({ ...r, history: [...r.history] })),
    minds,
    relations: s.relations.clone(),
    duets: [...s.duets],
    lastDuetAt: { ...s.lastDuetAt },
    avoidUntil: { ...s.avoidUntil },
    quarrelAt: { ...s.quarrelAt },
    met: new Set(s.met),
    simMs: s.simMs,
    realMs: s.realMs,
    nextDuetId: s.nextDuetId,
    duetLog: [...s.duetLog],
  }
}

const isNocturnal = (m: Mind, species: string, env: SimEnv): boolean =>
  env.nocturnalOf(species) !== m.traits.includes('nightowl')

function needMods(m: Mind, noct: boolean, env: SimEnv): Partial<Record<NeedKey, number>> {
  const mods: Partial<Record<NeedKey, number>> = {
    hunger: traitMultiplier(m.traits, 'hungerRate', env.traitTable),
  }
  if (noct) {
    if (env.phase === 'day') mods.sleepy = 1.5
    else if (env.phase === 'night') mods.sleepy = 0.5
  }
  return mods
}

function withoutTarget(r: Resident): Resident {
  const out: Resident = { ...r }
  delete out.targetX
  delete out.targetId
  return out
}

function toIdle(r: Resident): Resident {
  const out: Resident = { ...withoutTarget(r), state: 'idle', stateT: IDLE_AFTER_MS }
  delete out.duetId
  return out
}

const faceToward = (from: number, to: number, keep: 'left' | 'right'): 'left' | 'right' =>
  to < from ? 'left' : to > from ? 'right' : keep

/**
 * One pure simulation step. `dtMs` is real elapsed time: movement and duets run on it,
 * needs and relation decay run on dtMs * speed (see VillageState.realMs). Never mutates `input`.
 */
export function stepVillage(
  input: VillageState,
  dtMs: number,
  env: SimEnv,
  rng: () => number,
): { state: VillageState; events: SimEvent[] } {
  const s = cloneState(input)
  const duetEvents: SimEvent[] = []
  const stateEvents: SimEvent[] = []
  const iconEvents: SimEvent[] = []
  // Steps: 1 needs/clock, 2 duets, 3 free residents, 4 relief + state events, 5 need icons.
  const startStates = new Map(s.residents.map((r) => [r.id, r.state]))
  const index = new Map(s.residents.map((r, i) => [r.id, i]))
  const res = (id: string): Resident => s.residents[index.get(id)!]
  const put = (r: Resident): void => {
    s.residents[index.get(r.id)!] = r
  }

  // (1) needs, relation decay, clock
  const simDt = dtMs * env.speed
  for (const r of s.residents) {
    const m = s.minds[r.id]
    m.needs = advanceNeeds(m.needs, simDt, needMods(m, isNocturnal(m, r.species, env), env))
  }
  s.relations.decay(simDt)
  s.simMs += simDt
  s.realMs += dtMs

  // (2) duets
  const released = new Set<string>()
  const remaining: Duet[] = []
  for (const d of s.duets) {
    const prevStep = d.step
    const { duet, finished } = advanceDuet(d, dtMs)
    if (!finished) {
      for (let st = prevStep + 1; st <= duet.step; st++) {
        stepDuet(s, { ...duet, step: st }, env, duetEvents, res, put)
      }
      remaining.push(duet)
    } else {
      endDuet(s, duet, duetEvents, iconEvents, released, res, put)
    }
  }
  s.duets = remaining

  // (3) free residents
  const ended = new Set<string>()
  const walkRangeOf = env.walkRangeOf
  for (let i = 0; i < s.residents.length; i++) {
    const before = s.residents[i]
    if (before.state === 'duet' || released.has(before.id)) continue
    const m = s.minds[before.id]
    const noct = isNocturnal(m, before.species, env)
    const profile = env.profileOf(before.species)
    const base =
      effectivePhase(env.phase, noct) === 'night' ? profile.weights.night : profile.weights.default
    const ctx: AIContext = {
      phase: env.phase,
      walkRange: walkRangeOf(before.id),
      profile,
      weights: composeWeights(base, m.needs, m.traits, env.traitTable),
      targetXOf: (id) => (index.has(id) ? res(id).x : undefined),
    }
    let cur = tick(before, dtMs, ctx, rng)
    // A state ended when the name changed or tick restarted it (stateT jumped above the countdown).
    if (cur.state !== before.state || cur.stateT > before.stateT - dtMs) ended.add(before.id)
    if (cur.state === 'approach' && before.state !== 'approach') {
      const target = findTarget(s, cur, rng)
      cur = target === undefined ? toIdle(cur) : { ...cur, targetId: target }
    }
    s.residents[i] = cur
    if (cur.state === 'approach' && cur.stateT <= 0 && cur.targetId !== undefined) {
      const b = res(cur.targetId)
      if (inReach(cur.x, b.x)) {
        if (s.duets.length < MAX_DUETS && b.state !== 'duet' && b.state !== 'sleep') {
          beginDuet(s, cur, b, env, rng, duetEvents, put)
        } else {
          s.residents[i] = toIdle(cur)
        }
      }
    }
  }

  // Resize safety: anyone in a duet stays inside their walk range.
  for (const r of s.residents) {
    if (r.state !== 'duet') continue
    const x = clampX(r.x, walkRangeOf(r.id))
    if (x !== r.x) put({ ...r, x })
  }

  // (4) relief for states that ended (also when they rolled into themselves), then state events
  for (const r of s.residents) {
    const was = startStates.get(r.id)!
    const changed = was !== r.state
    const relief = RELIEF_ON_LEAVE[was]
    if (relief && (changed || ended.has(r.id))) {
      s.minds[r.id].needs = relieve(s.minds[r.id].needs, relief)
    }
    if (changed) stateEvents.push({ kind: 'state', id: r.id, state: r.state })
    if (changed && r.state === 'forage') iconEvents.push({ kind: 'icon', id: r.id, icon: 'leaf' })
  }

  // (5) need icons
  for (const r of s.residents) {
    const m = s.minds[r.id]
    const { fire, shown } = needIcons(m.needs, m.iconShown)
    m.iconShown = shown
    for (const icon of fire) iconEvents.push({ kind: 'icon', id: r.id, icon })
  }

  return { state: s, events: [...duetEvents, ...stateEvents, ...iconEvents] }
}

function findTarget(s: VillageState, self: Resident, rng: () => number): string | undefined {
  const asCandidate = (r: Resident): Candidate => ({
    id: r.id,
    lane: r.lane,
    x: r.x,
    state: r.state,
  })
  const others = s.residents.filter((r) => r.id !== self.id).map(asCandidate)
  const blocked = (id: string): boolean => {
    const key = pairKey(self.id, id)
    if ((s.avoidUntil[key] ?? -Infinity) > s.realMs) return true
    // Fast speeds shrink the sim-time cooldown: keep a quarrelled pair apart until makeUp can open.
    if (s.realMs - (s.quarrelAt[key] ?? -Infinity) < MAKEUP_WINDOW[0]) return true
    const last = s.lastDuetAt[key]
    return last !== undefined && last + PAIR_COOLDOWN_MS > s.simMs
  }
  return pickTarget(asCandidate(self), others, (id) => s.relations.get(self.id, id), blocked, rng)
}

function beginDuet(
  s: VillageState,
  approacher: Resident,
  target: Resident,
  env: SimEnv,
  rng: () => number,
  events: SimEvent[],
  put: (r: Resident) => void,
): void {
  const key = pairKey(approacher.id, target.id)
  const quarrelAgo = s.quarrelAt[key] === undefined ? undefined : s.realMs - s.quarrelAt[key]
  const ctx: DuetCtx = {
    band: s.relations.band(approacher.id, target.id),
    firstMeeting: !s.met.has(key),
    quarrelWindow:
      quarrelAgo !== undefined && quarrelAgo >= MAKEUP_WINDOW[0] && quarrelAgo <= MAKEUP_WINDOW[1],
    table: env.traitTable,
  }
  let a = approacher
  let b = target
  const type = chooseDuetType(s.minds[a.id], s.minds[b.id], ctx, rng)
  if (type === 'share' && s.minds[b.id].needs.hunger < s.minds[a.id].needs.hunger) {
    ;[a, b] = [b, a]
  }
  const duet = startDuet(`duet-${s.nextDuetId++}`, type, a.id, b.id, rng)
  const seat = (r: Resident, other: Resident): Resident => ({
    ...withoutTarget(r),
    state: 'duet',
    duetId: duet.id,
    stateT: duet.durationMs,
    facing: faceToward(r.x, other.x, r.facing),
  })
  put(seat(a, b))
  put(seat(b, a))
  s.duets.push(duet)
  s.met.add(key)
  events.push({ kind: 'duetStart', duet })
  if (SPEAKING.includes(type)) events.push({ kind: 'speak', id: a.id, duet })
}

function stepDuet(
  s: VillageState,
  duet: Duet,
  env: SimEnv,
  events: SimEvent[],
  res: (id: string) => Resident,
  put: (r: Resident) => void,
): void {
  events.push({ kind: 'duetStep', duet })
  if (SPEAKING.includes(duet.type)) {
    events.push({ kind: 'speak', id: duet.step % 2 === 0 ? duet.a : duet.b, duet })
  }
  if (duet.type !== 'chase') return
  const a = res(duet.a)
  const b = res(duet.b)
  // a runs one offset in the step direction; b takes a's old spot and so trails a.
  const sign = duet.step % 2 === 0 ? -1 : 1
  const rangeB = env.walkRangeOf(b.id)
  const ax = clampX(a.x + sign * CHASE_OFFSET, env.walkRangeOf(a.id))
  let bx = clampX(a.x, rangeB)
  // Never let b reach or pass a (a is pinned at an edge): fall back behind a.
  if (sign * (ax - bx) <= 0) bx = clampX(ax - sign * CHASE_OFFSET, rangeB)
  put({ ...a, x: ax, facing: faceToward(a.x, ax, a.facing) })
  put({ ...b, x: bx, facing: faceToward(b.x, bx, b.facing) })
}

function endDuet(
  s: VillageState,
  duet: Duet,
  events: SimEvent[],
  icons: SimEvent[],
  released: Set<string>,
  res: (id: string) => Resident,
  put: (r: Resident) => void,
): void {
  const key = pairKey(duet.a, duet.b)
  const ma = s.minds[duet.a]
  const mb = s.minds[duet.b]
  const outcome = DUET_RULES[duet.type].outcome(ma, mb)
  // Only completed duets add a relation, so "no relation yet" means this was the first meeting.
  const firstMeeting = !s.relations.has(duet.a, duet.b)
  const rel = s.relations.add(duet.a, duet.b, outcome.relation)
  ma.needs = relieve(ma.needs, outcome.a)
  mb.needs = relieve(mb.needs, outcome.b)

  const both = [duet.a, duet.b]
  const shown: [string[], IconKind | undefined] = (() => {
    switch (duet.type) {
      case 'greet':
        return [both, firstMeeting ? 'question' : undefined]
      case 'sitTogether': {
        const band = bandOf(rel)
        return [both, band === 'friend' || band === 'bestie' ? 'heart' : undefined]
      }
      case 'chase':
      case 'makeUp':
        return [both, 'heart']
      case 'share':
        return [[duet.b], 'leaf']
      case 'groom':
        return [both, 'sparkle']
      case 'quarrel':
        return [both, 'anger']
      default:
        return [both, undefined]
    }
  })()
  if (shown[1] !== undefined)
    for (const id of shown[0]) icons.push({ kind: 'icon', id, icon: shown[1] })

  for (const id of both) {
    put(toIdle(res(id)))
    released.add(id)
  }
  s.lastDuetAt[key] = s.simMs
  if (duet.type === 'quarrel') {
    s.avoidUntil[key] = s.realMs + AVOID_MS
    s.quarrelAt[key] = s.realMs
  } else if (duet.type === 'makeUp') {
    delete s.quarrelAt[key]
  }
  s.duetLog.push({ type: duet.type, a: duet.a, b: duet.b, at: s.simMs })
  if (s.duetLog.length > DUET_LOG_CAP) s.duetLog.splice(0, s.duetLog.length - DUET_LOG_CAP)
  events.push({ kind: 'duetEnd', duet })
}
