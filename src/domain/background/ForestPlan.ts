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

export interface ComposeLayerInput {
  placements: Placement[]
  tiles: Record<string, TileDef>
  palette: Record<string, string>
  /** Buffer size in native tile pixels (1 buffer pixel = 1 tile pixel). */
  widthPx: number
  heightPx: number
  /** First row of the ground band; the band runs to the bottom of the buffer. */
  groundRow?: number
  groundPalette?: { G: string; g: string; t: string; F?: string }
  /** Seed for the grass dither and flecks on the ground band. */
  seed?: number
  /** Buffer row of the tiles' ground line (default: heightPx). */
  layerRow?: number
}

/** Rows of line colour on top of the ground band (one tile pixel, as the old render drew). */
export const GROUND_LINE_ROWS = 1
const EARTH_SHARE = 1 / 3
const GROUND_SEED_OFFSET = 7000

function fillRect(
  buf: FrameBuffer,
  rgb: [number, number, number],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const x0 = Math.max(0, x)
  const x1 = Math.min(buf.w, x + w)
  const y0 = Math.max(0, y)
  const y1 = Math.min(buf.h, y + h)
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++)
      buf.rgba.set([rgb[0], rgb[1], rgb[2], 255], (yy * buf.w + xx) * 4)
  }
}

function paintGround(
  buf: FrameBuffer,
  top: number,
  gp: NonNullable<ComposeLayerInput['groundPalette']>,
  seed: number,
): void {
  const G = hexToRgb(gp.G)
  const g = hexToRgb(gp.g)
  const t = hexToRgb(gp.t)
  const F = hexToRgb(gp.F ?? gp.g)
  const bottom = buf.h
  const height = Math.max(0, bottom - top)
  const earthTop = bottom - Math.round(height * EARTH_SHARE)
  fillRect(buf, G, 0, top, buf.w, height)
  fillRect(buf, g, 0, top, buf.w, GROUND_LINE_ROWS)
  fillRect(buf, t, 0, earthTop, buf.w, bottom - earthTop)
  const rng = mulberry32(seed + GROUND_SEED_OFFSET)
  const bits = Math.ceil(buf.w / 3)
  for (let i = 0; i < bits; i++) {
    const x = Math.floor(rng() * buf.w)
    const up = 1 + Math.floor(rng() * 2)
    fillRect(buf, g, x, top - up, 2, up)
  }
  const flecks = Math.ceil(buf.w / 6)
  for (let i = 0; i < flecks; i++) {
    const x = Math.floor(rng() * buf.w)
    const y = top + 3 + Math.floor(rng() * Math.max(1, earthTop - top - 6))
    fillRect(buf, rng() < 0.5 ? g : F, x, y, 3, 1)
  }
}

/**
 * Composes a whole layer at native tile resolution into one RGBA buffer. Placement x is in
 * native pixels; a tile's top row is `layerRow - (ground + 1)`. Ground band is drawn first.
 */
export function composeLayer(input: ComposeLayerInput): FrameBuffer {
  const { placements, tiles, palette, widthPx, heightPx } = input
  const buf: FrameBuffer = {
    w: widthPx,
    h: heightPx,
    rgba: new Uint8ClampedArray(widthPx * heightPx * 4),
  }
  if (input.groundRow !== undefined && input.groundPalette) {
    paintGround(buf, input.groundRow, input.groundPalette, input.seed ?? 0)
  }
  const layerRow = input.layerRow ?? heightPx
  const cache = new Map<string, FrameBuffer>()
  for (const p of placements) {
    const tile = tiles[p.tile]
    let src = cache.get(p.tile)
    if (!src) {
      src = paintTile(tile, palette)
      cache.set(p.tile, src)
    }
    const oy = layerRow - (tile.ground + 1)
    const ox = Math.round(p.x)
    for (let y = 0; y < src.h; y++) {
      const py = oy + y
      if (py < 0 || py >= buf.h) continue
      for (let x = 0; x < src.w; x++) {
        const px = ox + x
        if (px < 0 || px >= buf.w) continue
        const si = (y * src.w + (p.flip ? src.w - 1 - x : x)) * 4
        if (src.rgba[si + 3] === 0) continue
        buf.rgba.set(src.rgba.subarray(si, si + 4), (py * buf.w + px) * 4)
      }
    }
  }
  return buf
}

/** Multiplies the colour channels in place by rgb/255 (alpha untouched). */
export function multiplyBuffer(buf: FrameBuffer, rgb: [number, number, number]): void {
  for (let i = 0; i < buf.rgba.length; i += 4) {
    buf.rgba[i] = Math.round((buf.rgba[i] * rgb[0]) / 255)
    buf.rgba[i + 1] = Math.round((buf.rgba[i + 1] * rgb[1]) / 255)
    buf.rgba[i + 2] = Math.round((buf.rgba[i + 2] * rgb[2]) / 255)
  }
}
