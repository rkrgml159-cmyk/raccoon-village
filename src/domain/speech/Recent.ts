import { bandOf, type Band } from '../social/Relations'

export const RECENT_CAP = 10

/** Returns a new list with `line` appended, keeping the newest RECENT_CAP entries. */
export function pushRecent(list: readonly string[], line: string): string[] {
  return [...list, line].slice(-RECENT_CAP)
}

/** Band of the strongest (highest value) relation the resident has; undefined when it has none. */
export function bestBand(snapshot: Record<string, number>, id: string): Band | undefined {
  let best: number | undefined
  for (const [key, v] of Object.entries(snapshot)) {
    const [a, b] = key.split('|')
    if (a !== id && b !== id) continue
    if (best === undefined || v > best) best = v
  }
  return best === undefined ? undefined : bandOf(best)
}

/** Weighted pick where dreamers count twice. */
export function pickDreamy<T extends { dreamer: boolean }>(
  items: readonly T[],
  rng: () => number,
): T | undefined {
  if (items.length === 0) return undefined
  const total = items.reduce((s, x) => s + (x.dreamer ? 2 : 1), 0)
  let r = rng() * total
  for (const x of items) {
    r -= x.dreamer ? 2 : 1
    if (r < 0) return x
  }
  return items[items.length - 1]
}
