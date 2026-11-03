import { mulberry32 } from '../rng'
import { createResident, type Resident } from '../resident/Resident'
import type { SpeciesDef } from '../sprites/types'

export interface VillageInput {
  seed: number
  n: number
  species: Record<string, SpeciesDef>
  variantsOf: (id: string, sp: SpeciesDef) => string[]
  bodyScaleOf: (id: string, variant: string) => number
}

const RACCOON_RATIO = 0.6
const MAX_HUMANS = 2
const MIN_GAP = 0.05
const X_MIN = 0.1
const X_MAX = 0.9
const EDGE: readonly [number, number] = [0.05, 0.95]

function pickWeighted(ids: string[], share: (id: string) => number, rng: () => number): string {
  const total = ids.reduce((sum, id) => sum + share(id), 0)
  let roll = rng() * total
  for (const id of ids) {
    roll -= share(id)
    if (roll < 0) return id
  }
  return ids[ids.length - 1]
}

function pickLane(sp: SpeciesDef, rng: () => number): 0 | 1 | 2 {
  const roll = rng()
  if (!sp.lanes) return Math.min(2, Math.floor(roll * 3)) as 0 | 1 | 2
  const total = sp.lanes[0] + sp.lanes[1] + sp.lanes[2]
  let acc = 0
  for (let i = 0; i < 3; i++) {
    acc += sp.lanes[i] / total
    if (roll < acc) return i as 0 | 1 | 2
  }
  return 2
}

function spreadLane(lane: Resident[]): void {
  const gap = Math.min(MIN_GAP, (EDGE[1] - EDGE[0]) / Math.max(1, lane.length - 1))
  lane.sort((a, b) => a.x - b.x)
  for (let i = 1; i < lane.length; i++) {
    if (lane[i].x < lane[i - 1].x + gap) lane[i].x = lane[i - 1].x + gap
  }
  const over = lane.length > 0 ? lane[lane.length - 1].x - EDGE[1] : 0
  if (over > 0) {
    for (const r of lane) r.x -= over
    // Left edge may now be below the clamp: re-push rightwards (always fits: gap <= range / (count - 1)).
    for (let i = 0; i < lane.length; i++) {
      const min = i === 0 ? EDGE[0] : lane[i - 1].x + gap
      if (lane[i].x < min) lane[i].x = min
    }
  }
}

export function createVillage(input: VillageInput): Resident[] {
  if (!Number.isInteger(input.n) || input.n < 0) throw new Error('n must be a non-negative integer')
  const { n, species, variantsOf, bodyScaleOf } = input
  const rng = mulberry32(input.seed)
  const others = Object.keys(species).filter((id) => id !== 'raccoon' && species[id].share > 0)
  const raccoons = Math.min(n, Math.ceil(n * RACCOON_RATIO))

  const picks: string[] = Array<string>(raccoons).fill('raccoon')
  let humans = 0
  for (let i = raccoons; i < n; i++) {
    let pool = others
    if (humans >= MAX_HUMANS) pool = others.filter((id) => id !== 'human')
    const id = pool.length > 0 ? pickWeighted(pool, (s) => species[s].share, rng) : 'raccoon'
    if (id === 'human') humans++
    picks.push(id)
  }

  const counts: Record<string, number> = {}
  const residents = picks.map((id) => {
    const sp = species[id]
    counts[id] = (counts[id] ?? 0) + 1
    const variants = variantsOf(id, sp)
    const variant = variants[Math.floor(rng() * variants.length)]
    const lane = pickLane(sp, rng)
    const x = X_MIN + rng() * (X_MAX - X_MIN)
    const r = createResident(`${id}-${counts[id]}`, x, {
      species: id,
      variant,
      lane,
      scale: sp.scale * bodyScaleOf(id, variant),
    })
    r.facing = rng() < 0.5 ? 'left' : 'right'
    return r
  })

  for (const lane of [0, 1, 2]) spreadLane(residents.filter((r) => r.lane === lane))
  return residents
}
