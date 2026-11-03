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
 * Lays every species out for the `?species=all` view: the largest go to the back lane; the rest
 * are split over the two front lanes. Each lane alternates big/small, lane 1 starts big and lane 2
 * small, and lane 1 shares lane 2's step shifted by half of it, so no species hides behind another.
 */
export function showcaseLayout(species: Record<string, SpeciesDef>): ShowcaseEntry[] {
  const ids = Object.keys(species).sort((a, b) => species[b].scale - species[a].scale)
  const back = ids.slice(0, BACK_COUNT)
  const rest = ids.slice(BACK_COUNT)
  const bigs = rest.slice(0, Math.ceil(rest.length / 2))
  const smalls = rest.slice(bigs.length)
  const take = (preferBig: boolean): string =>
    (preferBig ? (bigs.length > 0 ? bigs : smalls) : smalls.length > 0 ? smalls : bigs).shift()!
  const n1 = Math.max(0, Math.floor((rest.length - 1) / 2))
  const n2 = rest.length - n1
  const lane1 = Array.from({ length: n1 }, (_, j) => take(j % 2 === 0))
  const lane2 = Array.from({ length: n2 }, (_, j) => take(j % 2 === 1))
  const step2 = n2 > 1 ? (1 - 2 * MARGIN) / (n2 - 1) : 0
  const out: ShowcaseEntry[] = []
  back.forEach((id, i) => out.push({ id, lane: 0, x: spaced(back.length, i) }))
  // Lane 1 uses lane 2's step, so each of its animals sits midway between two lane-2 animals.
  lane1.forEach((id, i) => out.push({ id, lane: 1, x: MARGIN + step2 * (i + 0.5) }))
  lane2.forEach((id, i) => out.push({ id, lane: 2, x: spaced(n2, i) }))
  return out
}
