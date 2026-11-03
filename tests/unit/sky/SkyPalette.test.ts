import { describe, it, expect } from 'vitest'
import { getSky, lerpHex, lerpSky, SkyBlender } from '@domain/sky/SkyPalette'

describe('SkyPalette', () => {
  it('palette has all 16 keys with valid hex', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'])
      for (const p of ['dawn', 'day', 'dusk', 'night']) {
        const c = getSky(`${s}-${p}`)
        for (const h of [c.top, c.bottom, c.horizon]) expect(h).toMatch(/^#[0-9a-f]{6}$/)
        expect(c.starAlpha).toBeGreaterThanOrEqual(0)
        expect(c.starAlpha).toBeLessThanOrEqual(1)
      }
  })
  it('contains the specified anchor values', () => {
    expect(getSky('spring-day')).toEqual({
      top: '#9ec9e8',
      bottom: '#e8f1e4',
      horizon: '#c9d8c0',
      starAlpha: 0,
    })
    expect(getSky('autumn-dusk')).toEqual({
      top: '#5b4b7a',
      bottom: '#e58a4a',
      horizon: '#9a6a4f',
      starAlpha: 0.2,
    })
    expect(getSky('winter-night')).toEqual({
      top: '#0b1026',
      bottom: '#1d2742',
      horizon: '#2c3550',
      starAlpha: 1,
    })
  })
  it('unknown key falls back to spring-day', () =>
    expect(getSky('nope')).toEqual(getSky('spring-day')))
  it('lerpHex midpoint', () => expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080'))
  it('lerpHex returns lowercase and handles uppercase input', () =>
    expect(lerpHex('#AABBCC', '#AABBCC', 0.3)).toBe('#aabbcc'))
  it('lerpSky blends colors and starAlpha', () => {
    const r = lerpSky(
      { top: '#000000', bottom: '#000000', horizon: '#000000', starAlpha: 0 },
      { top: '#ffffff', bottom: '#ffffff', horizon: '#ffffff', starAlpha: 1 },
      0.5,
    )
    expect(r).toEqual({ top: '#808080', bottom: '#808080', horizon: '#808080', starAlpha: 0.5 })
  })
  it('blender reaches target after duration and snapTo is immediate', () => {
    const a = getSky('winter-night'),
      b = getSky('winter-dawn')
    const bl = new SkyBlender(a, 60000)
    bl.setTarget(b)
    bl.update(30000)
    expect(bl.current.top).not.toBe(a.top)
    expect(bl.current.top).not.toBe(b.top)
    bl.update(30000)
    expect(bl.current).toEqual(b)
    bl.snapTo(a)
    expect(bl.current).toEqual(a)
  })
  it('duration scales with speed (60s / speed)', () => {
    const bl = new SkyBlender(getSky('spring-day'), 60000 / 600)
    bl.setTarget(getSky('spring-dusk'))
    bl.update(100)
    expect(bl.current).toEqual(getSky('spring-dusk'))
  })
  it('setTarget mid-blend restarts from current blended colors', () => {
    const a = getSky('spring-day'),
      b = getSky('spring-night'),
      c = getSky('spring-dawn')
    const bl = new SkyBlender(a, 1000)
    bl.setTarget(b)
    const mid = bl.update(500)
    bl.setTarget(c)
    expect(bl.current).toEqual(mid)
    bl.update(1000)
    expect(bl.current).toEqual(c)
  })
  it('update with no target change keeps current; zero duration jumps', () => {
    const a = getSky('spring-day')
    const bl = new SkyBlender(a)
    expect(bl.update(5000)).toEqual(a)
    const z = new SkyBlender(a, 0)
    z.setTarget(getSky('spring-night'))
    expect(z.update(1)).toEqual(getSky('spring-night'))
  })
})
