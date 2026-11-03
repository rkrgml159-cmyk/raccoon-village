import { localParts } from './localParts'

export { localParts }

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface DateContext {
  phase: Phase
  season: Season
  moonPhase: number
  skyKey: `${Season}-${Phase}`
  hour: number
  minute: number
}

/** Start minutes of dawn, day, dusk, night; night runs until the next dawn. */
const BOUNDS: Record<Season, readonly [number, number, number, number]> = {
  spring: [300, 420, 1020, 1140],
  autumn: [300, 420, 1020, 1140],
  summer: [270, 390, 1110, 1230],
  winter: [360, 480, 990, 1110],
}

function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function phaseOf(season: Season, minutes: number): Phase {
  const [dawn, day, dusk, night] = BOUNDS[season]
  if (minutes >= dawn && minutes < day) return 'dawn'
  if (minutes >= day && minutes < dusk) return 'day'
  if (minutes >= dusk && minutes < night) return 'dusk'
  return 'night'
}

const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14)
const SYNODIC_DAYS = 29.530588
const DAY_MS = 86400e3

/** Lunar cycle position in [0, 1): 0 = new moon, 0.5 = full moon. */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / DAY_MS
  return (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS
}

export function computeDateContext(date: Date, tz = 'Asia/Seoul'): DateContext {
  const { month, hour, minute } = localParts(date, tz)
  const season = seasonOf(month)
  const phase = phaseOf(season, hour * 60 + minute)
  return { phase, season, moonPhase: moonPhase(date), skyKey: `${season}-${phase}`, hour, minute }
}
