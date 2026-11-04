import type { ResidentState } from '../resident/Resident'
import { REACH } from '../resident/UtilityAI'

export interface Candidate {
  id: string
  lane: 0 | 1 | 2
  x: number
  state: ResidentState
}

const UNAVAILABLE: readonly ResidentState[] = ['duet', 'sleep', 'approach']
const NEAR_EPS = 0.05

/**
 * Weighted pick among same-lane residents that are free to meet.
 * Weight: 1 / (0.05 + |dx|) * (1 + relation), so near friends are favoured.
 */
export function pickTarget(
  self: Candidate,
  others: Candidate[],
  relation: (id: string) => number,
  blocked: (id: string) => boolean,
  rng: () => number,
): string | undefined {
  const pool: { id: string; w: number }[] = []
  let total = 0
  for (const o of others) {
    if (o.id === self.id || o.lane !== self.lane) continue
    if (UNAVAILABLE.includes(o.state) || blocked(o.id)) continue
    const w = (1 / (NEAR_EPS + Math.abs(o.x - self.x))) * Math.max(0, 1 + relation(o.id))
    if (w <= 0) continue
    pool.push({ id: o.id, w })
    total += w
  }
  if (pool.length === 0) return undefined
  let roll = rng() * total
  for (const p of pool) {
    roll -= p.w
    if (roll < 0) return p.id
  }
  return pool[pool.length - 1].id
}

export function inReach(a: number, b: number): boolean {
  return Math.abs(a - b) <= REACH
}
