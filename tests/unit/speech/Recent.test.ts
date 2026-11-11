import { describe, it, expect } from 'vitest'
import { RECENT_CAP, bestBand, pickDreamy, pushRecent } from '../../../src/domain/speech/Recent'

describe('pushRecent', () => {
  it('appends and keeps only the newest RECENT_CAP lines', () => {
    let list: string[] = []
    for (let i = 0; i < RECENT_CAP + 3; i++) list = pushRecent(list, `l${i}`)
    expect(list).toHaveLength(RECENT_CAP)
    expect(list[0]).toBe('l3')
    expect(list[list.length - 1]).toBe(`l${RECENT_CAP + 2}`)
  })
  it('does not mutate its input', () => {
    const a = ['x']
    pushRecent(a, 'y')
    expect(a).toEqual(['x'])
  })
})

describe('bestBand', () => {
  it('is undefined without relations', () => {
    expect(bestBand({}, 'a')).toBeUndefined()
  })
  it('takes the highest value among pairs that include the resident', () => {
    const snap = { 'a|b': 0.1, 'a|c': 0.8, 'b|c': -0.9 }
    expect(bestBand(snap, 'a')).toBe('bestie')
    expect(bestBand(snap, 'b')).toBe('neutral')
  })
  it('reports awkward when every relation is negative', () => {
    expect(bestBand({ 'a|b': -0.5 }, 'a')).toBe('awkward')
  })
  it('ignores pairs of others', () => {
    expect(bestBand({ 'b|c': 0.9 }, 'a')).toBeUndefined()
  })
})

describe('pickDreamy', () => {
  const items = [
    { id: 'a', dreamer: false },
    { id: 'b', dreamer: true },
  ]
  it('weights dreamers twice (b wins for r >= 1/3)', () => {
    expect(pickDreamy(items, () => 0.1)?.id).toBe('a')
    expect(pickDreamy(items, () => 0.34)?.id).toBe('b')
    expect(pickDreamy(items, () => 0.99)?.id).toBe('b')
  })
  it('returns undefined for an empty list', () => {
    expect(pickDreamy([], () => 0.5)).toBeUndefined()
  })
})
