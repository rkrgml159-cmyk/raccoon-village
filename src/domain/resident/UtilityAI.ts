import type { Phase } from '../time/DateContext'
import { clampX } from '../village/Lanes'
import type { Resident, ResidentState } from './Resident'

export interface AIContext {
  phase: Phase
  walkRange: readonly [number, number]
}

export const WEIGHTS = {
  default: { idle: 0.7, walk: 0.2, sit: 0.1 },
  night: { idle: 0.75, walk: 0.05, sit: 0.2 },
}
export const DURATION_MS = { idle: [4000, 12000], sit: [6000, 20000] }
export const WALK_SPEED = 0.06 // x per second

const STATES: ResidentState[] = ['idle', 'walk', 'sit']
const HISTORY_SIZE = 3

export function chooseNext(
  prev: ResidentState,
  history: ResidentState[],
  phase: Phase,
  rng: () => number,
): ResidentState {
  const weights = phase === 'night' ? WEIGHTS.night : WEIGHTS.default
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
  const next = chooseNext(r.state, r.history, ctx.phase, rng)
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
      stateT: (travel / WALK_SPEED) * 1000,
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
  if (cur.state === 'walk' && cur.targetX !== undefined) {
    const step = (WALK_SPEED * dtMs) / 1000
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
