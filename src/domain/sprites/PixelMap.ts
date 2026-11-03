import type { PixelMap } from './types'

/** Role characters allowed in sprite pixel maps. '.' is transparent. */
export const SPRITE_ROLES: ReadonlySet<string> = new Set('.BbWLlDEPNMmHX'.split(''))

/** Role characters allowed in tile pixel maps. '.' is transparent. */
export const TILE_ROLES: ReadonlySet<string> = new Set('.TtGgFfRrKkVSDA'.split(''))

const TRANSPARENT = '.'

/**
 * Parses text rows into a flat PixelMap, validating row count, row width and roles.
 * Throws an Error describing the first violation found.
 */
export function parsePixelMap(
  rows: string[],
  size: [number, number],
  roles: ReadonlySet<string>,
): PixelMap {
  const [w, h] = size
  if (rows.length !== h) {
    throw new Error(`rows: expected ${h}, got ${rows.length}`)
  }

  const cells: string[] = []
  rows.forEach((row, y) => {
    if (row.length !== w) {
      throw new Error(`row ${y}: expected width ${w}, got ${row.length}`)
    }
    for (let x = 0; x < w; x++) {
      const role = row[x]
      if (role !== TRANSPARENT && !roles.has(role)) {
        throw new Error(`row ${y} col ${x}: unknown role '${role}'`)
      }
      cells.push(role)
    }
  })

  return { w, h, cells }
}

/** Returns the set of non-transparent roles that appear in the map. */
export function usedRoles(map: PixelMap): Set<string> {
  const used = new Set<string>()
  for (const cell of map.cells) {
    if (cell !== TRANSPARENT) used.add(cell)
  }
  return used
}
