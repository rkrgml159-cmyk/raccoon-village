import type { Phase } from '../time/DateContext'
import { clampX } from '../village/Lanes'
import type { Weights, SpeciesDef } from '../sprites/types'
import type { Resident, ResidentState } from './Resident'

export interface Profile {
  walkSpeed: number
  weights: { default: Weights; night: Weights }
  nocturnal: boolean
}

export interface AIContext {
  phase: Phase
  walkRange: readonly [number, number]
  profile: Profile
}

export const RIG_DEFAULT_PROFILE: Profile = {
  walkSpeed: 0.06, // x per second
  weights: {
    default: { idle: 0.6, walk: 0.2, sit: 0.12, sleep: 0.08 },
    night: { idle: 0.45, walk: 0.05, sit: 0.15, sleep: 0.35 },
  },
  nocturnal: false,
}
export const DURATION_MS = {
  idle: [4000, 12000],
  sit: [6000, 20000],
  sleep: [10000, 30000],
}

const STATES: ResidentState[] = ['idle', 'walk', 'sit', 'sleep']
const HISTORY_SIZE = 3

export function profileFor(sp: SpeciesDef): Profile {
  return {
    walkSpeed: sp.walkSpeed ?? RIG_DEFAULT_PROFILE.walkSpeed,
    weights: sp.weights ?? RIG_DEFAULT_PROFILE.weights,
    nocturnal: sp.nocturnal ?? RIG_DEFAULT_PROFILE.nocturnal,
  }
}

/** Nocturnal species live the day/night swap; dawn and dusk stay as they are. */
export function effectivePhase(phase: Phase, nocturnal: boolean): Phase {
  if (!nocturnal) return phase
  if (phase === 'night') return 'day'
  if (phase === 'day') return 'night'
  return phase
}

export function chooseNext(
  prev: ResidentState,
  history: ResidentState[],
  _phase: Phase,
  weights: Weights,
  rng: () => number,
): ResidentState {
  const last = history[history.length - 1]
  const candidates = STATES.filter((s) => {
    if (prev === s && last === s) return false
    if (s === 'walk' && prev === 'walk') return false
    return true
  })
  const total = candidates.reduce((sum, s) => sum + weights[s], 0)
  let roll = rng() * total
  for (const s of candidates) {
    roll -= weights[s]
    if (roll < 0) return s
  }
  return candidates[candidates.length - 1]
}

function sampleDuration(range: number[], rng: () => number): number {
  return range[0] + rng() * (range[1] - range[0])
}

function startState(r: Resident, ctx: AIContext, rng: () => number): Resident {
  const phase = effectivePhase(ctx.phase, ctx.profile.nocturnal)
  const weights = phase === 'night' ? ctx.profile.weights.night : ctx.profile.weights.default
  const next = chooseNext(r.state, r.history, phase, weights, rng)
  const history = [...r.history, r.state].slice(-HISTORY_SIZE)
  if (next === 'walk') {
    let dir = rng() < 0.5 ? -1 : 1
    const dist = 0.1 + rng() * 0.3
    let targetX = clampX(r.x + dir * dist, ctx.walkRange)
    if (Math.abs(targetX - r.x) < 0.01) {
      dir = -dir
      targetX = clampX(r.x + dir * dist, ctx.walkRange)
    }
    const travel = Math.abs(targetX - r.x)
    return {
      ...r,
      state: 'walk',
      targetX,
      stateT: (travel / ctx.profile.walkSpeed) * 1000,
      facing: targetX < r.x ? 'left' : 'right',
      history,
    }
  }
  const out: Resident = {
    ...r,
    state: next,
    stateT: sampleDuration(DURATION_MS[next], rng),
    history,
  }
  delete out.targetX
  return out
}

export function tick(r: Resident, dtMs: number, ctx: AIContext, rng: () => number): Resident {
  let cur: Resident = { ...r, history: [...r.history], stateT: r.stateT - dtMs }
  let expired = cur.stateT <= 0
  // The range can shrink mid-walk (resize/rotation): keep x and the target inside it.
  cur.x = clampX(cur.x, ctx.walkRange)
  let retargeted = false
  if (cur.state === 'walk' && cur.targetX !== undefined) {
    const clamped = clampX(cur.targetX, ctx.walkRange)
    if (clamped !== cur.targetX) {
      cur.targetX = clamped
      retargeted = true
    }
  }
  if (retargeted) {
    expired = true
  } else if (cur.state === 'walk' && cur.targetX !== undefined) {
    const step = (ctx.profile.walkSpeed * dtMs) / 1000
    const diff = cur.targetX - cur.x
    cur.facing = diff < 0 ? 'left' : 'right'
    if (Math.abs(diff) <= step) {
      cur.x = cur.targetX
      expired = true
    } else {
      cur.x += Math.sign(diff) * step
    }
  }
  if (expired) cur = startState(cur, ctx, rng)
  return cur
}
