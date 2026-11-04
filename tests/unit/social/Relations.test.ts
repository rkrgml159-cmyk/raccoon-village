import { describe, expect, it } from 'vitest'
import {
  BAND_MULTIPLIER,
  DECAY_PER_DAY,
  RelationTable,
  bandMultiplier,
  bandOf,
  pairKey,
} from '@domain/social/Relations'

const DAY_MS = 86_400_000

describe('Relations', () => {
  it('bandOf thresholds', () => {
    expect(bandOf(-0.2)).toBe('neutral')
    expect(bandOf(-0.21)).toBe('awkward')
    expect(bandOf(0.3)).toBe('friend')
    expect(bandOf(0.7)).toBe('bestie')
  })

  it('add clamps to -1..1 and returns the new value', () => {
    const t = new RelationTable()
    expect(t.add('a', 'b', 0.6)).toBeCloseTo(0.6, 9)
    expect(t.add('a', 'b', 0.6)).toBe(1)
    expect(t.get('a', 'b')).toBe(1)
    expect(t.add('a', 'b', -5)).toBe(-1)
    expect(t.get('b', 'a')).toBe(-1)
  })

  it('add creates the pair when missing', () => {
    const t = new RelationTable()
    expect(t.has('x', 'y')).toBe(false)
    expect(t.add('x', 'y', 0.25)).toBeCloseTo(0.25, 9)
    expect(t.has('y', 'x')).toBe(true)
  })

  it('pairKey symmetric', () => {
    expect(pairKey('b', 'a')).toBe('a|b')
    expect(pairKey('a', 'b')).toBe('a|b')
  })

  it('get is 0 when unknown', () => {
    expect(new RelationTable().get('a', 'b')).toBe(0)
  })

  it('has false for unknown', () => {
    expect(new RelationTable().has('a', 'b')).toBe(false)
  })

  it('band reflects stored value', () => {
    const t = new RelationTable()
    t.add('a', 'b', -0.5)
    expect(t.band('a', 'b')).toBe('awkward')
    expect(t.band('a', 'c')).toBe('neutral')
  })

  it('decay moves toward zero by 0.02 per day', () => {
    expect(DECAY_PER_DAY).toBe(0.02)
    const t = new RelationTable()
    t.add('a', 'b', 0.5)
    t.decay(DAY_MS)
    expect(t.get('a', 'b')).toBeCloseTo(0.48, 9)
  })

  it('decay does not cross zero', () => {
    const t = new RelationTable()
    t.add('a', 'b', -0.01)
    t.decay(DAY_MS)
    expect(t.get('a', 'b')).toBe(0)
  })

  it('decay moves negative values toward zero', () => {
    const t = new RelationTable()
    t.add('a', 'b', -0.5)
    t.decay(DAY_MS / 2)
    expect(t.get('a', 'b')).toBeCloseTo(-0.49, 9)
  })

  it('snapshot returns a plain copy keyed by pairKey', () => {
    const t = new RelationTable()
    t.add('b', 'a', 0.4)
    t.add('c', 'a', -0.3)
    const snap = t.snapshot()
    expect(snap).toEqual({ 'a|b': 0.4, 'a|c': -0.3 })
    snap['a|b'] = 0
    expect(t.get('a', 'b')).toBeCloseTo(0.4, 9)
  })

  it('bandMultiplier table', () => {
    expect(BAND_MULTIPLIER.awkward.greet).toBe(1.5)
    expect(BAND_MULTIPLIER.awkward.quarrel).toBe(1.5)
    expect(BAND_MULTIPLIER.friend.chat).toBe(1.3)
    expect(BAND_MULTIPLIER.friend.sitTogether).toBe(1.3)
    expect(BAND_MULTIPLIER.friend.groom).toBe(1.3)
    expect(BAND_MULTIPLIER.bestie.sitTogether).toBe(1.6)
    expect(BAND_MULTIPLIER.bestie.quarrel).toBe(0.2)

    expect(bandMultiplier('awkward', 'greet')).toBe(1.5)
    expect(bandMultiplier('awkward', 'chase')).toBe(0.5)
    expect(bandMultiplier('neutral', 'greet')).toBe(1)
    expect(bandMultiplier('friend', 'greet')).toBe(1)
    expect(bandMultiplier('friend', 'chat')).toBe(1.3)
    expect(bandMultiplier('bestie', 'quarrel')).toBe(0.2)
    expect(bandMultiplier('bestie', 'chase')).toBe(1)
  })
})
