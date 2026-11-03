import { describe, expect, it } from 'vitest'
import { hexToRgb, parseVariant, resolveVariant } from '../../../src/domain/sprites/Palette'
import type { SpeciesDef } from '../../../src/domain/sprites/types'

const base = { name: 'x', rig: 'r', scale: 1, share: 1 }

const fox: SpeciesDef = {
  ...base,
  palettes: { red: { B: '#c8622f', L: '#3a2a20' } },
  overlays: ['ears-a'],
}

const raccoon: SpeciesDef = {
  ...base,
  palettes: { grey: { B: '#8a8a8a' } },
  overlays: ['ears-round'],
  axes: {
    kind: { common: [], cozumel: ['tail-gold'] },
    mask: { default: ['mask-default'] },
    tail: { '5': ['tail-5'] },
    body: { baby: 0.7, normal: 1 },
  },
}

describe('parseVariant', () => {
  it('splits raccoon axes', () => {
    expect(parseVariant('grey|common|default|5|normal')).toEqual({
      palette: 'grey',
      kind: 'common',
      mask: 'default',
      tail: '5',
      body: 'normal',
    })
  })
  it('accepts a bare palette name', () => {
    expect(parseVariant('red')).toEqual({ palette: 'red' })
  })
  it('rejects a partial axis string', () => {
    expect(() => parseVariant('grey|common')).toThrow(/expected 5 fields/)
  })
})

describe('resolveVariant', () => {
  it('for a plain species', () => {
    const r = resolveVariant(fox, 'red')
    expect(r.palette.B).toEqual([200, 98, 47])
    expect(r.overlays).toEqual(['ears-a'])
    expect(r.bodyScale).toBe(1)
  })
  it('combines raccoon axes', () => {
    const r = resolveVariant(raccoon, 'grey|cozumel|default|5|baby')
    expect(r.overlays).toEqual(['ears-round', 'tail-gold', 'mask-default', 'tail-5'])
    expect(r.bodyScale).toBe(0.7)
  })
  it('rejects unknown palette', () => {
    expect(() => resolveVariant(fox, 'blue')).toThrow(/palette 'blue'/)
  })
  it('rejects unknown axis value', () => {
    expect(() => resolveVariant(raccoon, 'grey|common|x|5|normal')).toThrow(/mask 'x'/)
  })
  it('rejects axes on a species without axes', () => {
    expect(() => resolveVariant(fox, 'red|common|default|5|normal')).toThrow(
      /has axes but species has none/,
    )
  })
  it('requires all 5 fields for a species with axes', () => {
    expect(() => resolveVariant(raccoon, 'grey')).toThrow(/expected 5 fields/)
  })
  it('handles a species without overlays', () => {
    const r = resolveVariant({ ...base, palettes: { red: { B: '#000000' } } }, 'red')
    expect(r.overlays).toEqual([])
  })
})

describe('hexToRgb', () => {
  it('parses #rrggbb', () => {
    expect(hexToRgb('#FF0080')).toEqual([255, 0, 128])
  })
  it('rejects short hex', () => {
    expect(() => hexToRgb('#fff')).toThrow()
  })
  it('rejects non-hex digits', () => {
    expect(() => hexToRgb('#gggggg')).toThrow()
  })
})
