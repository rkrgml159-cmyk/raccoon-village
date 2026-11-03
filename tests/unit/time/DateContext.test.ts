import { describe, expect, it, vi } from 'vitest'
import { FixedClock } from '@domain/time/Clock'
import { computeDateContext, localParts } from '@domain/time/DateContext'

const seoul = (iso: string) => new FixedClock(iso).now()

describe('computeDateContext', () => {
  it.each([
    ['2026-04-10T05:00', 'spring', 'dawn'],
    ['2026-04-10T06:59', 'spring', 'dawn'],
    ['2026-04-10T07:00', 'spring', 'day'],
    ['2026-04-10T16:59', 'spring', 'day'],
    ['2026-04-10T17:00', 'spring', 'dusk'],
    ['2026-04-10T19:00', 'spring', 'night'],
    ['2026-07-10T04:30', 'summer', 'dawn'],
    ['2026-07-10T06:30', 'summer', 'day'],
    ['2026-07-10T18:30', 'summer', 'dusk'],
    ['2026-07-10T20:30', 'summer', 'night'],
    ['2026-10-10T04:59', 'autumn', 'night'],
    ['2026-10-10T05:00', 'autumn', 'dawn'],
    ['2026-01-10T06:00', 'winter', 'dawn'],
    ['2026-01-10T08:00', 'winter', 'day'],
    ['2026-01-10T16:30', 'winter', 'dusk'],
    ['2026-01-10T18:30', 'winter', 'night'],
    ['2026-12-31T23:59', 'winter', 'night'],
    ['2027-01-01T00:00', 'winter', 'night'],
    ['2026-03-01T12:00', 'spring', 'day'],
    ['2026-06-01T12:00', 'summer', 'day'],
    ['2026-09-01T12:00', 'autumn', 'day'],
    ['2026-12-01T12:00', 'winter', 'day'],
  ])('%s → %s %s', (iso, season, phase) => {
    const c = computeDateContext(seoul(iso))
    expect(c.season).toBe(season)
    expect(c.phase).toBe(phase)
  })
  it('reports hour and minute', () => {
    const c = computeDateContext(seoul('2026-04-10T07:05'))
    expect([c.hour, c.minute, c.moonPhase]).toEqual([7, 5, 0])
    expect(c.skyKey).toBe('spring-day')
  })
  it('uses given timezone', () => {
    expect(computeDateContext(new Date('2026-04-10T22:00:00Z'), 'Asia/Seoul').phase).toBe('day') // 07:00 KST
    expect(computeDateContext(new Date('2026-04-10T22:00:00Z'), 'UTC').phase).toBe('night')
  })
  it('never throws on extreme dates', () => {
    for (const d of [new Date(0), new Date('2200-06-15T12:00:00Z'), new Date(-1e12)])
      expect(() => computeDateContext(d)).not.toThrow()
  })
  it('falls back to local time on invalid tz', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => computeDateContext(new Date(), 'Not/AZone')).not.toThrow()
    expect(() => computeDateContext(new Date(), 'Not/AZone')).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('localParts', () => {
  it('normalizes midnight to hour 0', () => {
    expect(localParts(new Date('2026-04-10T15:00:00Z'), 'Asia/Seoul')).toEqual({
      year: 2026,
      month: 4,
      day: 11,
      hour: 0,
      minute: 0,
    })
  })
})
