import type { Needs } from '../mind/Needs'
import { traitMultiplier, type Trait, type TraitTable } from '../mind/Traits'
import { bandMultiplier, type Band } from './Relations'
import { DUET_TYPES, type DuetType } from './types'

export { DUET_TYPES }
export type { DuetType }

/**
 * A running duet. Its residents keep `state: 'duet'` with `stateT` fixed at `durationMs`
 * (it is not counted down): renderers read progress from `t`, `step` and `stepT`.
 */
export interface Duet {
  id: string
  type: DuetType
  a: string
  b: string
  t: number
  durationMs: number
  step: number
  stepT: number
}

export interface DuetMind {
  needs: Needs
  traits: readonly Trait[]
}

export interface DuetCtx {
  band: Band
  firstMeeting: boolean
  /** 60-300 s after a quarrel. */
  quarrelWindow: boolean
  table: TraitTable
}

export interface DuetRule {
  base: number
  duration: [number, number]
  stepMs: number
  eligible(a: DuetMind, b: DuetMind, ctx: DuetCtx): boolean
  /**
   * relation: delta added to the pair relation.
   * a / b: deltas to SUBTRACT from needs (relieve convention): positive = relief,
   * negative = the need increases.
   */
  outcome(a: DuetMind, b: DuetMind): { relation: number; a: Partial<Needs>; b: Partial<Needs> }
}

/** b runs toward a's x +/- offset, alternating each step (movement applied by Simulation). */
export const CHASE_OFFSET = 0.15

const BAND_ORDER: Record<Band, number> = { awkward: 0, neutral: 1, friend: 2, bestie: 3 }
const atLeast = (band: Band, min: Band): boolean => BAND_ORDER[band] >= BAND_ORDER[min]

export const DUET_RULES: Record<DuetType, DuetRule> = {
  greet: {
    base: 1.0,
    duration: [3000, 3000],
    stepMs: 1500,
    eligible: () => true,
    outcome: () => ({ relation: 0.05, a: { lonely: 0.2 }, b: { lonely: 0.2 } }),
  },
  chat: {
    base: 0.8,
    duration: [8000, 14000],
    stepMs: 2500,
    eligible: (_a, _b, c) => atLeast(c.band, 'neutral'),
    outcome: () => ({ relation: 0.1, a: { bored: 0.4 }, b: { bored: 0.4 } }),
  },
  sitTogether: {
    base: 0.6,
    duration: [20000, 40000],
    stepMs: 20000,
    eligible: (_a, _b, c) => atLeast(c.band, 'friend'),
    outcome: () => ({ relation: 0.08, a: { lonely: 0.6 }, b: { lonely: 0.6 } }),
  },
  chase: {
    base: 0.4,
    duration: [9000, 12000],
    stepMs: 3000,
    eligible: (a, b) => a.needs.bored >= 0.5 && b.needs.bored >= 0.5,
    outcome: () => ({ relation: 0.12, a: { bored: 0.8 }, b: { bored: 0.8 } }),
  },
  share: {
    base: 0.4,
    duration: [4000, 4000],
    stepMs: 4000,
    eligible: (a, b) => !a.traits.includes('glutton') && b.needs.hunger >= 0.5,
    outcome: () => ({ relation: 0.15, a: {}, b: { hunger: 0.5 } }),
  },
  groom: {
    base: 0.4,
    duration: [8000, 8000],
    stepMs: 4000,
    eligible: (_a, _b, c) => atLeast(c.band, 'friend'),
    outcome: () => ({ relation: 0.1, a: { lonely: 0.4 }, b: { lonely: 0.4 } }),
  },
  quarrel: {
    base: 0.08,
    duration: [5000, 5000],
    stepMs: 5000,
    eligible: (a, b, c) =>
      !atLeast(c.band, 'friend') && a.needs.bored >= 0.7 && b.needs.bored >= 0.7,
    outcome: (_a, b) => ({
      relation: -0.15,
      a: { bored: 0.3 },
      b: b.traits.includes('timid') ? { bored: 0.3, lonely: -0.2 } : { bored: 0.3 },
    }),
  },
  makeUp: {
    base: 1.0,
    duration: [5000, 5000],
    stepMs: 5000,
    eligible: (_a, _b, c) => c.quarrelWindow && c.band !== 'awkward',
    outcome: () => ({ relation: 0.2, a: {}, b: {} }),
  },
}

export function chooseDuetType(
  a: DuetMind,
  b: DuetMind,
  ctx: DuetCtx,
  rng: () => number,
): DuetType {
  if (ctx.firstMeeting) return 'greet'
  if (ctx.quarrelWindow && DUET_RULES.makeUp.eligible(a, b, ctx)) return 'makeUp'
  const traits = [...a.traits, ...b.traits]
  const options: { type: DuetType; w: number }[] = []
  let total = 0
  for (const type of DUET_TYPES) {
    const rule = DUET_RULES[type]
    if (type === 'makeUp' || !rule.eligible(a, b, ctx)) continue
    const w = rule.base * traitMultiplier(traits, type, ctx.table) * bandMultiplier(ctx.band, type)
    options.push({ type, w })
    total += w
  }
  if (options.length === 0 || total <= 0) return 'greet'
  let r = rng() * total
  for (const o of options) {
    r -= o.w
    if (r < 0) return o.type
  }
  return options[options.length - 1].type
}

export function startDuet(
  id: string,
  type: DuetType,
  a: string,
  b: string,
  rng: () => number,
): Duet {
  const [lo, hi] = DUET_RULES[type].duration
  return { id, type, a, b, t: 0, durationMs: lo + rng() * (hi - lo), step: 0, stepT: 0 }
}

export function advanceDuet(d: Duet, dtMs: number): { duet: Duet; finished: boolean } {
  const t = d.t + dtMs
  const stepMs = DUET_RULES[d.type].stepMs
  const step = Math.floor(t / stepMs)
  return {
    duet: { ...d, t, step, stepT: t - step * stepMs },
    finished: t >= d.durationMs,
  }
}
