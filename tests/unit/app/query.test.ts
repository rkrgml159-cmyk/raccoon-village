import { describe, it, expect } from 'vitest'
import { parseQuery } from '@app/query'

describe('parseQuery', () => {
  it('parses all params', () =>
    expect(parseQuery('?at=2026-01-15T22:00&speed=600&seed=7&still=1&debug=1')).toEqual({
      at: '2026-01-15T22:00',
      speed: 600,
      seed: 7,
      still: true,
      debug: true,
    }))
  it('defaults', () => expect(parseQuery('')).toEqual({ speed: 1, still: false, debug: false }))
  it('rejects bad speed', () => expect(parseQuery('?speed=-5').speed).toBe(1))
  it('rejects non-numeric speed and zero', () => {
    expect(parseQuery('?speed=abc').speed).toBe(1)
    expect(parseQuery('?speed=0').speed).toBe(1)
  })
  it('clamps sub-1 speed up to 1', () => {
    expect(parseQuery('?speed=0.5').speed).toBe(1)
    expect(parseQuery('?speed=0.001').speed).toBe(1)
  })
  it('clamps speed to 3600', () => expect(parseQuery('?speed=99999').speed).toBe(3600))
  it('accepts true for flags and ignores other values', () => {
    expect(parseQuery('?still=true&debug=true')).toMatchObject({ still: true, debug: true })
    expect(parseQuery('?still=0&debug=no')).toMatchObject({ still: false, debug: false })
  })
  it('ignores non-numeric seed and empty at', () => {
    expect(parseQuery('?seed=x&at=')).toEqual({ speed: 1, still: false, debug: false })
  })
  it('drops an unparseable at', () => {
    expect(parseQuery('?at=garbage')).not.toHaveProperty('at')
    expect(parseQuery('?at=2026-01-15Tzz:00')).not.toHaveProperty('at')
  })
})
