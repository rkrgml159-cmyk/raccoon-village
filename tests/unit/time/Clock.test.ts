import { describe, expect, it } from 'vitest'
import { FastClock, FixedClock, RealClock } from '@domain/time/Clock'

describe('Clock', () => {
  it('FixedClock parses local Seoul time', () => {
    expect(new FixedClock('2026-01-15T22:00').now().toISOString()).toBe('2026-01-15T13:00:00.000Z')
  })
  it('FixedClock honors explicit offset or Z', () => {
    expect(new FixedClock('2026-01-15T22:00Z').now().toISOString()).toBe('2026-01-15T22:00:00.000Z')
    expect(new FixedClock('2026-01-15T22:00+01:00').now().toISOString()).toBe(
      '2026-01-15T21:00:00.000Z',
    )
  })
  it('FixedClock works for other zones', () => {
    expect(new FixedClock('2026-01-15T22:00', 'UTC').now().toISOString()).toBe(
      '2026-01-15T22:00:00.000Z',
    )
    expect(new FixedClock('2026-07-15T12:00', 'America/New_York').now().toISOString()).toBe(
      '2026-07-15T16:00:00.000Z',
    )
  })
  it('FixedClock accepts seconds and falls back on unparsable input', () => {
    expect(new FixedClock('2026-01-15T22:00:30').now().toISOString()).toBe(
      '2026-01-15T13:00:30.000Z',
    )
    expect(Number.isNaN(new FixedClock('garbage').now().getTime())).toBe(true)
  })
  it('FastClock advances speed× real time', () => {
    let t = 0
    const real = { now: () => new Date(t) }
    const c = new FastClock(new Date('2026-06-01T00:00:00Z'), 600, real)
    t = 1000
    expect(c.now().toISOString()).toBe('2026-06-01T00:10:00.000Z')
  })
  it('RealClock returns current time', () => {
    const before = Date.now()
    const t = new RealClock().now().getTime()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })
})
