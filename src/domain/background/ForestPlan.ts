import { mulberry32 } from '../rng'
import type { SkyColors } from '../sky/SkyPalette'
import type { FrameBuffer } from '../sprites/Compose'
import { hexToRgb } from '../sprites/Palette'
import { parsePixelMap, TILE_ROLES } from '../sprites/PixelMap'
import type { SceneLayer, TileDef } from '../sprites/types'

/** x = left edge of the tile in view pixels. */
export interface Placement {
  tile: string
  x: number
  flip: boolean
}

const SLOTS_PER_VIEW = 12
const JITTER = 0.6
const LAYER_SEED_STEP = 1000
const TINT_MIN = 0.35
const LAYER_ORDER = ['back', 'mid', 'front']

function pick(
  entries: SceneLayer['tiles'],
  counts: Map<string, number>,
  rng: () => number,
): string | null {
  const open = entries.filter((e) => e.max === undefined || (counts.get(e.id) ?? 0) < e.max)
  const total = open.reduce((s, e) => s + e.w, 0)
  if (open.length === 0 || total <= 0) return null
  let r = rng() * total
  for (const e of open) {
    r -= e.w
    if (r < 0) return e.id
  }
  return open[open.length - 1].id
}

/** Deterministic tile placement for one layer. */
export function planLayer(
  layer: SceneLayer,
  tiles: Record<string, TileDef>,
  seed: number,
  viewWidthPx: number,
  tileScale: number,
): Placement[] {
  const rng = mulberry32(seed + LAYER_ORDER.indexOf(layer.id) * LAYER_SEED_STEP)
  const counts = new Map<string, number>()
  const out: Placement[] = []
  const widthOf = (id: string): number => tiles[id].size[0] * tileScale

  if (layer.id === 'back') {
    let x = 0
    while (x < viewWidthPx) {
      const id = pick(layer.tiles, counts, rng)
      if (id === null) break
      out.push({ tile: id, x, flip: rng() < 0.5 })
      x += widthOf(id)
    }
    return out
  }

  const count = Math.max(1, Math.round(layer.density * SLOTS_PER_VIEW))
  const slot = viewWidthPx / count

  // Required copies (`min`) go into distinct, randomly chosen slots first.
  const required: string[] = []
  for (const e of layer.tiles) for (let k = 0; k < (e.min ?? 0); k++) required.push(e.id)
  const slots = Array.from({ length: count }, (_, i) => i)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  const reserved = new Map<number, string>()
  required.slice(0, count).forEach((id, k) => {
    reserved.set(slots[k], id)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  })

  for (let i = 0; i < count; i++) {
    const jitter = rng() * slot * JITTER
    const fixed = reserved.get(i)
    const id = fixed ?? pick(layer.tiles, counts, rng)
    const flip = rng() < 0.5
    if (id === null) continue
    if (fixed === undefined) counts.set(id, (counts.get(id) ?? 0) + 1)
    out.push({ tile: id, x: slot * i + jitter - widthOf(id) / 2, flip })
  }
  return out
}

/** Grey multiplier from the brightness of the sky's bottom colour, clamped to 0.35..1. */
export function tintFor(sky: SkyColors): number {
  const [r, g, b] = hexToRgb(sky.bottom)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const v = Math.round(Math.min(1, Math.max(TINT_MIN, lum)) * 255)
  return (v << 16) | (v << 8) | v
}

/** Renders a tile's pixel map to RGBA using a season palette; '.' stays transparent. */
export function paintTile(tile: TileDef, palette: Record<string, string>): FrameBuffer {
  const map = parsePixelMap(tile.rows, tile.size, TILE_ROLES)
  const rgba = new Uint8ClampedArray(map.w * map.h * 4)
  const cache = new Map<string, [number, number, number]>()
  map.cells.forEach((role, i) => {
    if (role === '.') return
    let rgb = cache.get(role)
    if (!rgb) {
      rgb = hexToRgb(palette[role])
      cache.set(role, rgb)
    }
    rgba.set([rgb[0], rgb[1], rgb[2], 255], i * 4)
  })
  return { w: map.w, h: map.h, rgba }
}
