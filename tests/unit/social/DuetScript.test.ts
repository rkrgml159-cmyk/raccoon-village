import { describe, it, expect } from 'vitest'
import { facesLeft, scriptFor, sitOffset } from '@domain/social/DuetScript'
import { DUET_TYPES } from '@domain/social/types'

describe('scriptFor', () => {
  it('covers every type, step and role', () => {
    for (const t of DUET_TYPES)
      for (const step of [0, 1, 2])
        for (const role of ['a', 'b'] as const) {
          const c = scriptFor(t, step, role)
          expect(c.anim).toBeTruthy()
          expect(['toward', 'away', 'same']).toContain(c.flip)
        }
  })
  it('greet: a interact_a, b interact_b, toward', () => {
    expect(scriptFor('greet', 0, 'a')).toEqual({ anim: 'interact_a', flip: 'toward', offsetX: 0 })
    expect(scriptFor('greet', 1, 'b')).toEqual({ anim: 'interact_b', flip: 'toward', offsetX: 0 })
  })
  it('chat and groom swap on odd steps', () => {
    for (const t of ['chat', 'groom'] as const) {
      expect(scriptFor(t, 0, 'a').anim).toBe('interact_a')
      expect(scriptFor(t, 0, 'b').anim).toBe('interact_b')
      expect(scriptFor(t, 1, 'a').anim).toBe('interact_b')
      expect(scriptFor(t, 1, 'b').anim).toBe('interact_a')
      expect(scriptFor(t, 2, 'a').anim).toBe('interact_a')
    }
  })
  it('sitTogether: both sit, same facing, placed by sitOffset', () => {
    for (const step of [0, 1, 2]) {
      for (const role of ['a', 'b'] as const) {
        expect(scriptFor('sitTogether', step, role)).toEqual({
          anim: 'sit',
          flip: 'same',
          offsetX: 0,
        })
      }
    }
  })

  it('sitOffset seats the pair 0.03 apart around their midpoint, by side not role', () => {
    // a on the right of b (approached from the right)
    const ax = 0.56
    const bx = 0.5
    const fa = ax + sitOffset(ax, bx, 'a')
    const fb = bx + sitOffset(bx, ax, 'b')
    expect(fb).toBeCloseTo(0.515, 9)
    expect(fa).toBeCloseTo(0.545, 9)
    // same x: role a goes left
    expect(0.5 + sitOffset(0.5, 0.5, 'a')).toBeCloseTo(0.485, 9)
    expect(0.5 + sitOffset(0.5, 0.5, 'b')).toBeCloseTo(0.515, 9)
  })

  it('chase: the runner (a) faces away from the chaser, b chases toward', () => {
    expect(scriptFor('chase', 1, 'a')).toMatchObject({ anim: 'walk', flip: 'away' })
    expect(scriptFor('chase', 1, 'b')).toMatchObject({ anim: 'walk', flip: 'toward' })
  })

  it('share: giver then receiver happy', () => {
    expect(scriptFor('share', 0, 'a').anim).toBe('interact_a')
    expect(scriptFor('share', 0, 'b').anim).toBe('idle')
    expect(scriptFor('share', 1, 'b').anim).toBe('happy')
    expect(scriptFor('share', 2, 'b').anim).toBe('happy')
  })
  it('quarrel: both sulk facing away', () => {
    for (const role of ['a', 'b'] as const)
      expect(scriptFor('quarrel', 0, role)).toEqual({ anim: 'sulk', flip: 'away', offsetX: 0 })
  })
  it('makeUp: interact then both happy', () => {
    expect(scriptFor('makeUp', 0, 'a').anim).toBe('interact_a')
    expect(scriptFor('makeUp', 0, 'b').anim).toBe('interact_b')
    expect(scriptFor('makeUp', 1, 'a').anim).toBe('happy')
    expect(scriptFor('makeUp', 2, 'b').anim).toBe('happy')
  })
})

describe('facesLeft', () => {
  it('toward faces the partner', () => {
    expect(facesLeft('toward', 0.5, 0.4, false)).toBe(true)
    expect(facesLeft('toward', 0.4, 0.5, true)).toBe(false)
  })
  it('away faces opposite', () => {
    expect(facesLeft('away', 0.5, 0.4, true)).toBe(false)
    expect(facesLeft('away', 0.4, 0.5, false)).toBe(true)
  })
  it('same always faces right; equal x keeps facing', () => {
    expect(facesLeft('same', 0.5, 0.4, true)).toBe(false)
    expect(facesLeft('toward', 0.5, 0.5, true)).toBe(true)
  })
})
