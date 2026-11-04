import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRAITS } from '../src/domain/mind/Traits'
import {
  SITUATIONS,
  validateThoughts,
  violations,
  type ThoughtEntry,
  type ThoughtsData,
} from '../src/domain/speech/Thoughts'

interface BatchLine {
  trait: string
  situation: string
  species: string
  line: string
}

const MAX_CHARS = 22
const THOUGHTS_PATH = resolve('data/dialogue/thoughts.json')
const FORBIDDEN_PATH = resolve('data/dialogue/forbidden.json')

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function normalise(line: string): string {
  const t = line.trim()
  const chars = [...t]
  const last = chars[chars.length - 1]
  const endsWithLetter = /\p{L}/u.test(last)
  if (endsWithLetter && chars.length < MAX_CHARS && !t.includes('.')) return `${t}.`
  return t
}

function rule(line: string, forbidden: string[]): string | null {
  const cps = [...line]
  if (cps.length > MAX_CHARS) return 'too long'
  if (cps.filter((c) => c === '.').length > 1) return 'more than one period'
  if (/[0-9]/.test(line)) return 'digit'
  if (cps.some((c) => (c.codePointAt(0) ?? 0) >= 0x1f000)) return 'emoji'
  if (violations([line], forbidden).length > 0) return 'forbidden word'
  return null
}

function rank(list: readonly string[], v: string): number {
  return v === 'any' ? -1 : list.indexOf(v)
}

function speciesRank(a: string, b: string): number {
  if (a === b) return 0
  if (a === 'any') return -1
  if (b === 'any') return 1
  return a.localeCompare(b)
}

function main(): void {
  const batchPath = process.argv[2]
  if (!batchPath) {
    console.error('usage: tsx scripts/merge-thoughts.ts <batch.json>')
    process.exit(1)
  }
  const batch = readJson<{ accepted: BatchLine[] }>(resolve(batchPath))
  const data = readJson<ThoughtsData>(THOUGHTS_PATH)
  const forbidden = readJson<string[]>(FORBIDDEN_PATH)

  const seen = new Set(data.entries.flatMap((e) => e.lines))
  const groups = new Map<string, ThoughtEntry>()
  for (const e of data.entries) groups.set(`${e.situation}|${e.trait}|${e.species}`, e)

  let added = 0
  let skipped = 0
  let normalised = 0
  for (const b of batch.accepted) {
    const line = normalise(b.line)
    let reason: string | null
    if (!SITUATIONS.includes(b.situation)) reason = 'unknown situation'
    else if (b.trait !== 'any' && !(TRAITS as readonly string[]).includes(b.trait))
      reason = 'unknown trait'
    else if (seen.has(line)) reason = 'duplicate'
    else reason = rule(line, forbidden)
    if (reason) {
      skipped++
      console.log(`skip [${reason}] ${b.situation}/${b.trait}/${b.species}: ${b.line}`)
      continue
    }
    if (line !== b.line.trim()) normalised++
    seen.add(line)
    const key = `${b.situation}|${b.trait}|${b.species}`
    let entry = groups.get(key)
    if (!entry) {
      entry = {
        situation: b.situation,
        trait: b.trait as ThoughtEntry['trait'],
        species: b.species,
        lines: [],
      }
      groups.set(key, entry)
      data.entries.push(entry)
    }
    entry.lines.push(line)
    added++
  }

  data.entries.sort(
    (a, b) =>
      rank(SITUATIONS, a.situation) - rank(SITUATIONS, b.situation) ||
      rank(TRAITS, a.trait) - rank(TRAITS, b.trait) ||
      speciesRank(a.species, b.species),
  )

  validateThoughts(data, forbidden)
  writeFileSync(THOUGHTS_PATH, `${JSON.stringify(data, null, 2)}\n`)
  const total = data.entries.reduce((n, e) => n + e.lines.length, 0)
  console.log(`added=${added} skipped=${skipped} periodAdded=${normalised} total=${total}`)
}

main()
