import { parsePixelMap, SPRITE_ROLES } from './PixelMap'
import { hexToRgb } from './Palette'
import type { ResolvedVariant } from './Palette'
import type { PartDef, PixelMap, RigDef, SpriteState } from './types'

export interface FrameBuffer {
  w: number
  h: number
  rgba: Uint8ClampedArray
}

export interface ComposeInput {
  rig: RigDef
  state: SpriteState
  index: number
  variant: ResolvedVariant
  parts: Record<string, PartDef>
}

const TRANSPARENT = '.'
const FIXED_ROLE = 'X'

function paint(
  buf: FrameBuffer,
  map: PixelMap,
  ox: number,
  oy: number,
  palette: ResolvedVariant['palette'],
  fixed?: string,
): void {
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const role = map.cells[y * map.w + x]
      if (role === TRANSPARENT) continue
      const px = ox + x
      const py = oy + y
      if (px < 0 || py < 0 || px >= buf.w || py >= buf.h) continue
      let rgb: [number, number, number] | undefined
      if (role === FIXED_ROLE) {
        if (fixed === undefined) throw new Error(`role 'X' requires a fixed color`)
        rgb = hexToRgb(fixed)
      } else {
        rgb = palette[role]
        if (!rgb) throw new Error(`palette has no role '${role}'`)
      }
      const i = (py * buf.w + px) * 4
      buf.rgba[i] = rgb[0]
      buf.rgba[i + 1] = rgb[1]
      buf.rgba[i + 2] = rgb[2]
      buf.rgba[i + 3] = 255
    }
  }
}

/** Layers below-parts, the body, then above-parts into an RGBA buffer. */
export function composeFrame(input: ComposeInput): FrameBuffer {
  const { rig, state, index, variant, parts } = input
  const frame = rig.frames[state][index]
  const [w, h] = rig.size
  const buf: FrameBuffer = { w, h, rgba: new Uint8ClampedArray(w * h * 4) }
  const body = parsePixelMap(frame.rows, rig.size, SPRITE_ROLES)

  const resolved = variant.overlays.map((id) => {
    const part = parts[id]
    if (!part) throw new Error(`part '${id}' not found`)
    const anchor = frame.anchors[part.anchor]
    if (!anchor) throw new Error(`part '${id}': anchor '${part.anchor}' not in frame`)
    const v = part.states?.[state] ?? part
    const map = parsePixelMap(v.rows, [v.rows[0].length, v.rows.length], SPRITE_ROLES)
    return { part, map, x: anchor[0] + v.offset[0], y: anchor[1] + v.offset[1] }
  })

  const draw = (layer: PartDef['layer']): void => {
    for (const r of resolved) {
      if (r.part.layer === layer) paint(buf, r.map, r.x, r.y, variant.palette, r.part.fixed)
    }
  }
  draw('below')
  paint(buf, body, 0, 0, variant.palette)
  draw('above')
  return buf
}
