import type { SpeciesDef } from '../sprites/types'

export interface ShowcaseEntry {
  id: string
  lane: 0 | 1 | 2
  x: number
}

const MARGIN = 0.08
const BACK_COUNT = 3

function spaced(count: number, index: number): number {
  if (count <= 1) return 0.5
  return MARGIN + (index * (1 - 2 * MARGIN)) / (count - 1)
}

/**
 * Lays every species out for the `?species=all` view: the largest go to the back lane, the
 * rest alternate large/small along the two front lanes so big animals never stack.
 */
export function showcaseLayout(species: Record<string, SpeciesDef>): ShowcaseEntry[] {
  const ids = Object.keys(species).sort((a, b) => species[b].scale - species[a].scale)
  const back = ids.slice(0, BACK_COUNT)
  const rest = ids.slice(BACK_COUNT)
  const mixed: string[] = []
  let lo = 0
  let hi = rest.length - 1
  while (lo <= hi) {
    mixed.push(rest[lo++])
    if (lo <= hi) mixed.push(rest[hi--])
  }
  const lanes: string[][] = [back, [], []]
  // Pairs (big, small) go to lane 1, then lane 2, so each lane alternates big/small. Lane 1 is
  // laid out small-first so its big animals sit between the big ones of lane 2, not above them.
  for (let k = 0; k < mixed.length; k += 2) {
    const lane = (k / 2) % 2 === 0 ? 1 : 2
    const pair = mixed.slice(k, k + 2)
    lanes[lane].push(...(lane === 1 ? pair.reverse() : pair))
  }
  const out: ShowcaseEntry[] = []
  lanes.forEach((list, lane) =>
    list.forEach((id, i) => out.push({ id, lane: lane as 0 | 1 | 2, x: spaced(list.length, i) })),
  )
  return out
}
