import { TRAITS, type Trait } from '../mind/Traits'
import type { Needs } from '../mind/Needs'
import type { DuetType } from '../social/types'
import type { Band } from '../social/Relations'
import type { Phase, Season } from '../time/DateContext'

export const SITUATIONS: readonly string[] = [
  'hungry',
  'sleepy',
  'bored',
  'lonely',
  'afterGreet',
  'afterChat',
  'afterSit',
  'afterChase',
  'afterShare',
  'afterGroom',
  'afterQuarrel',
  'afterMakeUp',
  'bestie',
  'friend',
  'awkward',
  'dawn',
  'day',
  'dusk',
  'night',
  'spring',
  'summer',
  'autumn',
  'winter',
  'forest',
  'ruin',
  'moon',
  'rain',
  'idleLong',
  'walkFar',
  'sleepWake',
]

export interface ThoughtEntry {
  situation: string
  trait: Trait | 'any'
  species: string
  lines: string[]
}
export interface ThoughtsData {
  situations: string[]
  entries: ThoughtEntry[]
}
export interface ThoughtCtx {
  lastDuet?: DuetType
  needs: Needs
  band?: Band
  phase: Phase
  season: Season
  traits: readonly Trait[]
  species: string
  idleMs: number
}

const AFTER: Record<DuetType, string> = {
  greet: 'afterGreet',
  chat: 'afterChat',
  sitTogether: 'afterSit',
  chase: 'afterChase',
  share: 'afterShare',
  groom: 'afterGroom',
  quarrel: 'afterQuarrel',
  makeUp: 'afterMakeUp',
}
const NEED_SITUATIONS: readonly (readonly [keyof Needs, string])[] = [
  ['hunger', 'hungry'],
  ['sleepy', 'sleepy'],
  ['bored', 'bored'],
  ['lonely', 'lonely'],
]
const NEED_THRESHOLD = 0.8

export function situationFor(c: ThoughtCtx): string[] {
  const out: string[] = []
  if (c.lastDuet) out.push(AFTER[c.lastDuet])
  for (const [k, s] of NEED_SITUATIONS) if (c.needs[k] >= NEED_THRESHOLD) out.push(s)
  if (c.band === 'bestie' || c.band === 'friend' || c.band === 'awkward') out.push(c.band)
  out.push(...ambientFor(c), 'idleLong')
  return out
}

/** Time, season and place: drawn as one pool so no single situation hides the rest. */
function ambientFor(c: ThoughtCtx): string[] {
  const out = [c.phase, c.season, 'forest', 'ruin']
  if (c.phase === 'night') out.push('moon')
  return out
}

function draw(lines: string[], rng: () => number): string {
  return lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))]
}

export function pickThought(
  c: ThoughtCtx,
  data: ThoughtsData,
  recent: string[],
  rng: () => number,
): string | null {
  const ambient = new Set(ambientFor(c))
  const tiers: string[][] = []
  for (const sit of situationFor(c)) {
    if (!ambient.has(sit)) tiers.push([sit])
    else if (tiers.at(-1)?.every((t) => ambient.has(t))) tiers.at(-1)!.push(sit)
    else tiers.push([sit])
  }
  for (const tier of tiers) {
    const entries = data.entries.filter(
      (e) => tier.includes(e.situation) && (e.species === 'any' || e.species === c.species),
    )
    const fresh = (es: ThoughtEntry[]): string[] =>
      es.flatMap((e) => e.lines).filter((l) => !recent.includes(l))
    const traited = fresh(entries.filter((e) => e.trait !== 'any' && c.traits.includes(e.trait)))
    const pool = traited.length > 0 ? traited : fresh(entries.filter((e) => e.trait === 'any'))
    if (pool.length > 0) return draw(pool, rng)
  }
  return null
}

export function violations(lines: string[], forbidden: string[]): string[] {
  return lines.filter((l) => forbidden.some((w) => l.includes(w)))
}

const MAX_CHARS = 22

function isEmoji(cp: number): boolean {
  return cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)
}

export function validateThoughts(data: unknown, forbidden: string[]): ThoughtsData {
  const fail = (m: string): never => {
    throw new Error(`thoughts: ${m}`)
  }
  if (typeof data !== 'object' || data === null) return fail('must be an object')
  const d = data as Record<string, unknown>
  if (
    !Array.isArray(d.situations) ||
    d.situations.length !== SITUATIONS.length ||
    !SITUATIONS.every((s, i) => d.situations && (d.situations as unknown[])[i] === s)
  ) {
    return fail('situations must equal the 30 known ids')
  }
  if (!Array.isArray(d.entries)) return fail('entries must be an array')
  const seen = new Set<string>()
  d.entries.forEach((raw: unknown, i: number) => {
    if (typeof raw !== 'object' || raw === null) return fail(`entry ${i} must be an object`)
    const e = raw as Record<string, unknown>
    if (typeof e.situation !== 'string' || !SITUATIONS.includes(e.situation)) {
      return fail(`entry ${i} unknown situation`)
    }
    if (e.trait !== 'any' && !(TRAITS as readonly unknown[]).includes(e.trait)) {
      return fail(`entry ${i} unknown trait`)
    }
    if (typeof e.species !== 'string' || e.species === '') return fail(`entry ${i} bad species`)
    if (!Array.isArray(e.lines) || e.lines.length === 0) return fail(`entry ${i} needs lines`)
    for (const line of e.lines as unknown[]) {
      if (typeof line !== 'string' || line === '') return fail(`entry ${i} line must be a string`)
      const cps = [...line]
      if (cps.length > MAX_CHARS) return fail(`"${line}" exceeds ${MAX_CHARS} chars`)
      if (cps.filter((ch) => ch === '.').length > 1) return fail(`"${line}" has more than one .`)
      if (/[0-9]/.test(line)) return fail(`"${line}" has a digit`)
      if (cps.some((ch) => isEmoji(ch.codePointAt(0) ?? 0))) return fail(`"${line}" has emoji`)
      if (violations([line], forbidden).length > 0) return fail(`"${line}" has a forbidden word`)
      if (seen.has(line)) return fail(`"${line}" is a duplicate`)
      seen.add(line)
    }
  })
  return data as ThoughtsData
}
