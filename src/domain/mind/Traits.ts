export type Trait =
  'calm' | 'curious' | 'timid' | 'glutton' | 'chatty' | 'dreamer' | 'tidy' | 'nightowl'

export const TRAITS: readonly Trait[] = [
  'calm',
  'curious',
  'timid',
  'glutton',
  'chatty',
  'dreamer',
  'tidy',
  'nightowl',
]

/** trait -> { key: multiplier } */
export type TraitTable = Record<Trait, Record<string, number>>

/** Two distinct traits: first uniform of 8, second uniform of the remaining 7. */
export function assignTraits(rng: () => number): [Trait, Trait] {
  const pool = [...TRAITS]
  const a = pool.splice(Math.floor(rng() * pool.length), 1)[0]
  const b = pool[Math.floor(rng() * pool.length)]
  return [a, b]
}

export function traitMultiplier(traits: readonly Trait[], key: string, table: TraitTable): number {
  let m = 1
  for (const t of traits) m *= table[t]?.[key] ?? 1
  return m
}

export function validateTraitTable(table: unknown): TraitTable {
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    throw new Error('traits: table must be an object')
  }
  const rec = table as Record<string, unknown>
  const keys = Object.keys(rec)
  for (const k of keys) {
    if (!(TRAITS as readonly string[]).includes(k)) throw new Error(`traits: unknown trait ${k}`)
  }
  for (const t of TRAITS) {
    if (!keys.includes(t)) throw new Error(`traits: missing trait ${t}`)
    const row = rec[t]
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`traits: ${t} must be an object`)
    }
    for (const [key, v] of Object.entries(row)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        throw new Error(`traits: ${t}.${key} must be a finite positive number`)
      }
    }
  }
  return table as TraitTable
}
