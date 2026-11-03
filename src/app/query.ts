export interface BootOptions {
  at?: string
  speed: number
  seed?: number
  still: boolean
  debug: boolean
}

const MAX_SPEED = 3600

const flag = (v: string | null): boolean => v === '1' || v === 'true'

export function parseQuery(search: string): BootOptions {
  const q = new URLSearchParams(search)
  const rawSpeed = Number(q.get('speed'))
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.min(rawSpeed, MAX_SPEED) : 1
  const opts: BootOptions = { speed, still: flag(q.get('still')), debug: flag(q.get('debug')) }
  const at = q.get('at')
  if (at) opts.at = at
  const seedRaw = q.get('seed')
  if (seedRaw !== null && seedRaw !== '' && Number.isFinite(Number(seedRaw)))
    opts.seed = Number(seedRaw)
  return opts
}
