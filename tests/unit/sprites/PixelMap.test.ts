import { describe, expect, it } from 'vitest'
import { parsePixelMap, SPRITE_ROLES, TILE_ROLES, usedRoles } from '@domain/sprites/PixelMap'

describe('PixelMap', () => {
  it('parses a 3x2 map into cells', () => {
    const map = parsePixelMap(['.B.', 'LLL'], [3, 2], SPRITE_ROLES)
    expect(map.w).toBe(3)
    expect(map.h).toBe(2)
    expect(map.cells).toHaveLength(6)
    expect(map.cells[1]).toBe('B')
    expect(map.cells[3]).toBe('L')
  })

  it('rejects wrong row count', () => {
    expect(() => parsePixelMap(['.B.'], [3, 2], SPRITE_ROLES)).toThrow(/rows/)
  })

  it('rejects wrong row length', () => {
    expect(() => parsePixelMap(['.B', 'LLL'], [3, 2], SPRITE_ROLES)).toThrow(/row 0/)
  })

  it('rejects unknown role', () => {
    expect(() => parsePixelMap(['.Z.', 'LLL'], [3, 2], SPRITE_ROLES)).toThrow(/'Z'/)
  })

  it('tile roles accept T and G but not B', () => {
    expect(() => parsePixelMap(['TG'], [2, 1], TILE_ROLES)).not.toThrow()
    expect(() => parsePixelMap(['B.'], [2, 1], TILE_ROLES)).toThrow()
  })

  it('usedRoles excludes transparent', () => {
    const map = parsePixelMap(['.B.', 'LLL'], [3, 2], SPRITE_ROLES)
    expect(usedRoles(map)).toEqual(new Set(['B', 'L']))
  })
})
