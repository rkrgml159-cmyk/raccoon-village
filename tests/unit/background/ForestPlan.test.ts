import { describe, expect, it } from 'vitest'
import {
  GROUND_LINE_ROWS,
  composeLayer,
  multiplyBuffer,
  paintTile,
  planLayer,
  tintFor,
} from '../../../src/domain/background/ForestPlan'
import type { SceneLayer, TileDef } from '../../../src/domain/sprites/types'

function tile(id: string, w = 10, h = 8): TileDef {
  return { id, size: [w, h], rows: Array.from({ length: h }, () => 'T'.repeat(w)), ground: h - 1 }
}

const TILES: Record<string, TileDef> = {
  a: tile('a'),
  b: tile('b', 12),
  cabin: tile('cabin', 20),
}

const back: SceneLayer = {
  id: 'back',
  y: 0.56,
  scale: 2,
  density: 0.9,
  tiles: [
    { id: 'a', w: 3 },
    { id: 'b', w: 2 },
  ],
}

const mid: SceneLayer = {
  id: 'mid',
  y: 0.62,
  scale: 2.5,
  density: 0.55,
  tiles: [
    { id: 'a', w: 4 },
    { id: 'cabin', w: 5, max: 1 },
  ],
}

describe('planLayer', () => {
  it('back layer covers the full width', () => {
    const scale = 2
    const plan = planLayer(back, TILES, 7, 640, scale)
    expect(plan[0].x).toBe(0)
    const last = plan[plan.length - 1]
    const lastW = TILES[last.tile].size[0] * scale
    expect(last.x + lastW).toBeGreaterThanOrEqual(640)
    for (let i = 1; i < plan.length; i++) {
      const prev = plan[i - 1]
      expect(plan[i].x).toBeCloseTo(prev.x + TILES[prev.tile].size[0] * scale)
    }
  })

  it('mid layer count follows density', () => {
    expect(planLayer(mid, TILES, 3, 800, 2.5)).toHaveLength(7)
  })

  it('keeps at least one slot for tiny density', () => {
    expect(planLayer({ ...mid, density: 0 }, TILES, 3, 800, 2.5)).toHaveLength(1)
  })

  it('respects max', () => {
    for (let seed = 0; seed < 30; seed++) {
      const plan = planLayer({ ...mid, density: 1 }, TILES, seed, 800, 2.5)
      expect(plan.filter((p) => p.tile === 'cabin').length).toBeLessThanOrEqual(1)
    }
  })

  it('skips the slot when no candidate is left', () => {
    const only: SceneLayer = { ...mid, tiles: [{ id: 'cabin', w: 1, max: 1 }] }
    expect(planLayer(only, TILES, 1, 800, 2.5)).toHaveLength(1)
  })

  it('places min copies for every seed', () => {
    const layer: SceneLayer = {
      ...mid,
      tiles: [
        { id: 'a', w: 4 },
        { id: 'b', w: 1 },
        { id: 'cabin', w: 1, min: 1, max: 1 },
      ],
    }
    for (let seed = 0; seed < 20; seed++) {
      const plan = planLayer(layer, TILES, seed, 800, 2.5)
      expect(plan.filter((p) => p.tile === 'cabin')).toHaveLength(1)
      expect(plan).toHaveLength(7)
    }
  })

  it('deterministic for seed', () => {
    expect(planLayer(mid, TILES, 42, 800, 2.5)).toEqual(planLayer(mid, TILES, 42, 800, 2.5))
  })

  it('changes with seed', () => {
    expect(planLayer(mid, TILES, 1, 800, 2.5)).not.toEqual(planLayer(mid, TILES, 2, 800, 2.5))
  })
})

describe('tintFor', () => {
  const sky = (bottom: string) => ({ top: bottom, bottom, horizon: bottom, starAlpha: 0 })
  it('night sky gives a dark grey', () => {
    const c = tintFor(sky('#26324a'))
    const r = (c >> 16) & 0xff
    expect(r).toBeLessThan(0x80)
    expect(c).toBe(r * 0x010101)
  })
  it('bright sky gives white', () => {
    expect(tintFor(sky('#ffffff'))).toBe(0xffffff)
  })
  it('day sky is near white', () => {
    expect((tintFor(sky('#e8f1e4')) >> 16) & 0xff).toBeGreaterThan(0xe0)
  })
})

describe('paintTile', () => {
  it('paints roles with palette colours and leaves dots transparent', () => {
    const t: TileDef = { id: 't', size: [2, 1], rows: ['.G'], ground: 0 }
    const buf = paintTile(t, { G: '#102030' })
    expect(buf.w).toBe(2)
    expect(buf.h).toBe(1)
    expect(Array.from(buf.rgba)).toEqual([0, 0, 0, 0, 0x10, 0x20, 0x30, 255])
  })
})

describe('composeLayer', () => {
  const pal = { G: '#102030', g: '#405060', t: '#708090', F: '#a0b0c0' }
  const px = (b: { w: number; rgba: Uint8ClampedArray }, x: number, y: number): number[] =>
    Array.from(b.rgba.slice((y * b.w + x) * 4, (y * b.w + x) * 4 + 4))
  // 2x2 tile: top row '.G', bottom row 'G.', ground = 1 (bottom row on the line)
  const t2: TileDef = { id: 't2', size: [2, 2], rows: ['.G', 'G.'], ground: 1 }
  const base = { tiles: { t2 }, palette: pal, widthPx: 8, heightPx: 6, layerRow: 4 }

  it('paints a tile at x and layerRow - (ground + 1)', () => {
    // y_top = 4 - 2 = 2
    const buf = composeLayer({ ...base, placements: [{ tile: 't2', x: 3, flip: false }] })
    expect(buf.w).toBe(8)
    expect(buf.h).toBe(6)
    expect(px(buf, 4, 2)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 3, 3)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 3, 2)[3]).toBe(0)
    expect(px(buf, 4, 3)[3]).toBe(0)
  })

  it('mirrors flipped tiles horizontally', () => {
    const buf = composeLayer({ ...base, placements: [{ tile: 't2', x: 3, flip: true }] })
    expect(px(buf, 3, 2)[3]).toBe(255)
    expect(px(buf, 4, 3)[3]).toBe(255)
    expect(px(buf, 4, 2)[3]).toBe(0)
  })

  it('clips at the buffer edges', () => {
    const buf = composeLayer({
      ...base,
      placements: [
        { tile: 't2', x: -1, flip: false },
        { tile: 't2', x: 7, flip: false },
      ],
    })
    expect(px(buf, 0, 3)[3]).toBe(0)
    expect(px(buf, 0, 2)[3]).toBe(255)
    expect(px(buf, 7, 3)[3]).toBe(255)
    expect(buf.rgba.length).toBe(8 * 6 * 4)
  })

  it('fills the ground band: line on top, earth on the lower third', () => {
    const buf = composeLayer({
      ...base,
      widthPx: 12,
      heightPx: 12,
      placements: [],
      groundRow: 3,
      groundPalette: { G: pal.G, g: pal.g, t: pal.t },
    })
    expect(px(buf, 5, 11)).toEqual([0x70, 0x80, 0x90, 255])
    expect(px(buf, 5, 3)).toEqual([0x40, 0x50, 0x60, 255])
    expect(px(buf, 5, 4)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 5, 5)[3]).toBe(255)
    expect(px(buf, 5, 8)).toEqual([0x10, 0x20, 0x30, 255])
  })

  it('starts the soil at soilStartRow when it is lower than the default', () => {
    const buf = composeLayer({
      ...base,
      widthPx: 12,
      heightPx: 12,
      placements: [],
      groundRow: 3,
      groundPalette: { G: pal.G, g: pal.g, t: pal.t },
      soilStartRow: 10,
    })
    expect(px(buf, 5, 8)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 5, 9)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 5, 10)).toEqual([0x70, 0x80, 0x90, 255])
    expect(px(buf, 5, 11)).toEqual([0x70, 0x80, 0x90, 255])
  })

  it('never lets soilStartRow raise the soil above the default third', () => {
    const buf = composeLayer({
      ...base,
      widthPx: 12,
      heightPx: 12,
      placements: [],
      groundRow: 3,
      groundPalette: { G: pal.G, g: pal.g, t: pal.t },
      soilStartRow: 4,
    })
    expect(px(buf, 5, 8)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 5, 9)).toEqual([0x70, 0x80, 0x90, 255])
  })

  it('draws tiles over the ground band', () => {
    const buf = composeLayer({
      ...base,
      heightPx: 12,
      layerRow: 6,
      placements: [{ tile: 't2', x: 0, flip: false }],
      groundRow: 4,
      groundPalette: { G: pal.G, g: pal.g, t: pal.t },
    })
    // tile rows 4..5; row 4 col 1 is tile 'G' over the ground-line colour
    expect(px(buf, 1, 4)).toEqual([0x10, 0x20, 0x30, 255])
    expect(px(buf, 0, 4)).toEqual([0x40, 0x50, 0x60, 255])
  })

  it('leaves a single-tile layer opaque only where the tile is', () => {
    const buf = composeLayer({ ...base, placements: [{ tile: 't2', x: 3, flip: false }] })
    let opaque = 0
    let clear = 0
    for (let i = 3; i < buf.rgba.length; i += 4) {
      if (buf.rgba[i] === 255) opaque++
      else if (buf.rgba[i] === 0) clear++
    }
    expect(opaque).toBe(2)
    expect(clear).toBe(8 * 6 - 2)
  })

  describe('ground band', () => {
    const W = 60
    const ROW = 10
    const groundOf = (seed: number, F?: string) =>
      composeLayer({
        ...base,
        widthPx: W,
        heightPx: 30,
        placements: [],
        groundRow: ROW,
        groundPalette: { G: pal.G, g: pal.g, t: pal.t, F },
        seed,
      })
    const rowOf = (b: ReturnType<typeof groundOf>, y: number): number[][] =>
      Array.from({ length: W }, (_, x) => px(b, x, y))
    const G = [0x10, 0x20, 0x30, 255]
    const g = [0x40, 0x50, 0x60, 255]
    const F = [0xa0, 0xb0, 0xc0, 255]

    it('differs between seeds', () => {
      const a = groundOf(1, pal.F).rgba
      const b = groundOf(2, pal.F).rgba
      expect(a.some((v, i) => v !== b[i])).toBe(true)
    })

    it('is byte-identical for the same seed', () => {
      expect(Array.from(groundOf(5, pal.F).rgba)).toEqual(Array.from(groundOf(5, pal.F).rgba))
    })

    it('dithers grass in the row just above the band', () => {
      const above = rowOf(groundOf(3), ROW - 1)
      expect(above.some((c) => c.join() === g.join())).toBe(true)
      expect(above.some((c) => c[3] === 0)).toBe(true)
    })

    it('scatters F flecks inside the band when F is given', () => {
      const buf = groundOf(3, pal.F)
      let flecks = 0
      for (let y = ROW; y < 30; y++)
        flecks += rowOf(buf, y).filter((c) => c.join() === F.join()).length
      expect(flecks).toBeGreaterThan(0)
      for (let y = 0; y < ROW; y++)
        expect(rowOf(buf, y).some((c) => c.join() === F.join())).toBe(false)
    })

    it('draws exactly GROUND_LINE_ROWS rows of line colour on top (one, as before)', () => {
      expect(GROUND_LINE_ROWS).toBe(1)
      const buf = groundOf(3, pal.F)
      for (let y = ROW; y < ROW + GROUND_LINE_ROWS; y++)
        expect(rowOf(buf, y).every((c) => c.join() === g.join())).toBe(true)
      expect(rowOf(buf, ROW + GROUND_LINE_ROWS).every((c) => c.join() === G.join())).toBe(true)
    })
  })
})

describe('multiplyBuffer', () => {
  it('multiplies rgb channels by 0..255 factors and keeps alpha', () => {
    const buf = { w: 1, h: 1, rgba: new Uint8ClampedArray([200, 100, 50, 255]) }
    multiplyBuffer(buf, [255, 128, 0])
    expect(Array.from(buf.rgba)).toEqual([200, 50, 0, 255])
  })
})
