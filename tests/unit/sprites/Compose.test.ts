import { describe, expect, it } from 'vitest'
import { composeFrame } from '../../../src/domain/sprites/Compose'
import type { ResolvedVariant } from '../../../src/domain/sprites/Palette'
import type { Frame, PartDef, RigDef, SpriteState } from '../../../src/domain/sprites/types'

const frame: Frame = { rows: ['....', '.BB.', '.BB.', '.L..'], anchors: { head: [1, 1] } }
const states: SpriteState[] = [
  'idle',
  'walk',
  'sit',
  'sleep',
  'shake',
  'interact_a',
  'interact_b',
  'happy',
  'sulk',
]
const rig: RigDef = {
  id: 'r',
  size: [4, 4],
  frames: Object.fromEntries(states.map((s) => [s, [frame]])) as RigDef['frames'],
  frameRate: Object.fromEntries(states.map((s) => [s, 1])) as RigDef['frameRate'],
}
const variant = (extra: Record<string, [number, number, number]> = {}): ResolvedVariant => ({
  palette: { B: [255, 0, 0], L: [0, 255, 0], M: [0, 0, 255], m: [9, 9, 9], ...extra },
  overlays: ['p'],
  bodyScale: 1,
})
const part = (over: Partial<PartDef>): PartDef => ({
  id: 'p',
  rigs: ['r'],
  anchor: 'head',
  layer: 'above',
  offset: [0, 0],
  rows: ['M'],
  ...over,
})
const px = (b: { w: number; rgba: Uint8ClampedArray }, x: number, y: number) =>
  Array.from(b.rgba.slice((y * b.w + x) * 4, (y * b.w + x) * 4 + 4))
const run = (p: PartDef, v = variant(), state: SpriteState = 'idle') =>
  composeFrame({ rig, state, index: 0, variant: v, parts: { p } })

describe('composeFrame', () => {
  it('paints body roles with palette', () => {
    const v = { ...variant(), overlays: [] }
    const b = composeFrame({ rig, state: 'idle', index: 0, variant: v, parts: {} })
    expect(px(b, 1, 1)).toEqual([255, 0, 0, 255])
    expect(px(b, 1, 3)).toEqual([0, 255, 0, 255])
    expect(px(b, 0, 0)[3]).toBe(0)
  })
  it('places an above part at anchor + offset', () => {
    expect(px(run(part({ offset: [1, -1] })), 2, 0)).toEqual([0, 0, 255, 255])
  })
  it('below part is covered by body', () => {
    expect(px(run(part({ layer: 'below' })), 1, 1)).toEqual([255, 0, 0, 255])
  })
  it('below part shows where the body is transparent', () => {
    expect(px(run(part({ layer: 'below', offset: [-1, 0] })), 0, 1)).toEqual([0, 0, 255, 255])
  })
  it('transparent part pixels leave the body untouched', () => {
    expect(px(run(part({ rows: ['.'] })), 1, 1)).toEqual([255, 0, 0, 255])
  })
  it('uses state-specific rows', () => {
    const p = part({ states: { sit: { offset: [0, 0], rows: ['m'] } } })
    expect(px(run(p, variant(), 'sit'), 1, 1)).toEqual([9, 9, 9, 255])
    expect(px(run(p, variant(), 'idle'), 1, 1)).toEqual([0, 0, 255, 255])
  })
  it('clips parts outside the canvas', () => {
    const b = run(part({ offset: [3, 3], rows: ['MM', 'MM'] }))
    expect(b.rgba.length).toBe(64)
    expect(px(b, 0, 0)[3]).toBe(0)
    expect(px(run(part({ offset: [-5, -5], rows: ['MM', 'MM'] })), 0, 0)[3]).toBe(0)
  })
  it('X uses fixed color', () => {
    const b = run(part({ rows: ['X'], fixed: '#123456' }))
    expect(px(b, 1, 1)).toEqual([18, 52, 86, 255])
    expect(() => run(part({ rows: ['X'] }))).toThrow(/fixed/)
  })
  it('missing palette role throws', () => {
    const v = variant()
    delete v.palette.L
    expect(() => run(part({}), v)).toThrow(/role 'L'/)
  })
  it('missing part throws', () => {
    expect(() =>
      composeFrame({ rig, state: 'idle', index: 0, variant: variant(), parts: { q: part({}) } }),
    ).toThrow(/part 'p' not found/)
  })
})
