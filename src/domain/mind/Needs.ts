export type NeedKey = 'hunger' | 'sleepy' | 'bored' | 'lonely'
export interface Needs {
  hunger: number
  sleepy: number
  bored: number
  lonely: number
}

/** Simulated ms for a need to climb from 0 to 1. */
export const NEED_FULL_MS: Record<NeedKey, number> = {
  hunger: 14_400_000,
  sleepy: 28_800_000,
  bored: 5_400_000,
  lonely: 7_200_000,
}
export const NEED_ICON_ON = 0.8
export const NEED_ICON_OFF = 0.5

/** Need name -> key in `UI.icons`. */
export const NEED_ICON_KEY: Record<NeedKey, string> = {
  hunger: 'leaf',
  sleepy: 'sleepy',
  bored: 'bored',
  lonely: 'lonely',
}

const KEYS: readonly NeedKey[] = ['hunger', 'sleepy', 'bored', 'lonely']
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Each need uniform in [0.2, 0.6]. */
export function initialNeeds(rng: () => number): Needs {
  const out = { hunger: 0, sleepy: 0, bored: 0, lonely: 0 }
  for (const k of KEYS) out[k] = 0.2 + rng() * 0.4
  return out
}

export function advanceNeeds(
  n: Needs,
  simDtMs: number,
  mods: Partial<Record<NeedKey, number>>,
): Needs {
  const out = { ...n }
  for (const k of KEYS) out[k] = clamp01(n[k] + (simDtMs / NEED_FULL_MS[k]) * (mods[k] ?? 1))
  return out
}

export function relieve(n: Needs, delta: Partial<Needs>): Needs {
  const out = { ...n }
  for (const k of KEYS) out[k] = clamp01(n[k] - (delta[k] ?? 0))
  return out
}

export function needIcons(n: Needs, shown: Set<NeedKey>): { fire: NeedKey[]; shown: Set<NeedKey> } {
  const next = new Set(shown)
  const fire: NeedKey[] = []
  for (const k of KEYS) {
    if (n[k] >= NEED_ICON_ON && !next.has(k)) {
      fire.push(k)
      next.add(k)
    } else if (n[k] < NEED_ICON_OFF) {
      next.delete(k)
    }
  }
  return { fire, shown: next }
}
