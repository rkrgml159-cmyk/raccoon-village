import { FixedClock } from '@domain/time/Clock'

export interface BootOptions {
  at?: string
  speed: number
  seed?: number
  still: boolean
  debug: boolean
  sheet?: string
}

const MAX_SPEED = 3600

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
  const opts: BootOptions = { speed, still: flag(q.get('still')), debug: flag(q.get('debug')) }
  const at = q.get('at')
  if (at && isValidAt(at)) opts.at = at
  const seedRaw = q.get('seed')
  if (seedRaw !== null && seedRaw !== '' && Number.isFinite(Number(seedRaw)))
    opts.seed = Number(seedRaw)
  const sheet = q.get('sheet')
  if (sheet) opts.sheet = sheet
  return opts
}
