import { FixedClock } from '@domain/time/Clock'
import { DUET_TYPES, type DuetType } from '@domain/social/types'

export interface BootOptions {
  at?: string
  speed: number
  n: number
  seed?: number
  still: boolean
  debug: boolean
  sheet?: string
  species?: 'all'
  duet?: DuetType | 'all'
}

const MAX_SPEED = 3600
const DEFAULT_N = 12
const MIN_N = 1
const MAX_N = 40

const flag = (v: string | null): boolean => v === '1' || v === 'true'

/** True when `at` parses to a real instant (same parsing the clock uses). */
export function isValidAt(at: string): boolean {
  return !Number.isNaN(new FixedClock(at).now().getTime())
}

export function parseQuery(search: string): BootOptions {
  const q = new URLSearchParams(search)
  const rawSpeed = Number(q.get('speed'))
  const speed =
    Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.max(1, Math.min(rawSpeed, MAX_SPEED)) : 1
  const nRaw = q.get('n')
  const nNum = nRaw === null || nRaw.trim() === '' ? NaN : Number(nRaw)
  const n = Number.isFinite(nNum) ? Math.max(MIN_N, Math.min(MAX_N, Math.round(nNum))) : DEFAULT_N
  const opts: BootOptions = {
    speed,
    n,
    still: flag(q.get('still')),
    debug: flag(q.get('debug')),
  }
  const at = q.get('at')
  if (at && isValidAt(at)) opts.at = at
  const seedRaw = q.get('seed')
  if (seedRaw !== null && seedRaw !== '' && Number.isFinite(Number(seedRaw)))
    opts.seed = Number(seedRaw)
  const sheet = q.get('sheet')
  if (sheet) opts.sheet = sheet
  if (q.get('species') === 'all') opts.species = 'all'
  const duet = q.get('duet')
  if (duet === 'all') opts.duet = 'all'
  else if (duet !== null && (DUET_TYPES as readonly string[]).includes(duet))
    opts.duet = duet as DuetType
  return opts
}
