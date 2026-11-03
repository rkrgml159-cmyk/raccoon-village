import Phaser from 'phaser'
import { mulberry32 } from '@domain/rng'
import { paintTile, planLayer, tintFor } from '@domain/background/ForestPlan'
import type { SkyColors } from '@domain/sky/SkyPalette'
import { hexToRgb } from '@domain/sprites/Palette'
import type { SceneDef, SceneLayer, TileDef } from '@domain/sprites/types'
import type { Season } from '@domain/time/DateContext'
import type { View } from '../sky/SkyLayer'

const DEPTH: Record<SceneLayer['id'], number> = { back: -5, mid: -3, front: 5000 }
const REFERENCE_SIZE = 360
/** Ground band: top line thickness and the share of the band (from the bottom) that is earth. */
const EARTH_SHARE = 1 / 3
const GROUND_LINE_TILES = 1
const GROUND_SEED_OFFSET = 7000

const toInt = (hex: string): number => parseInt(hex.slice(1), 16)

/**
 * Draws the mossy forest: one RenderTexture per layer (back, mid, front), rebuilt only when the
 * season or the view changes. Tint (time of day) is applied through the texture's tint.
 */
export class ForestLayer {
  private textures: Phaser.GameObjects.RenderTexture[] = []
  private w = 0
  private h = 0
  private view: View = { x: 0, y: 0, width: 0, height: 0 }
  private builtSeason: Season | null = null
  private dirty = true
  private lastTint = -1
  private lastHorizon = ''

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: SceneDef,
    private readonly tiles: Record<string, TileDef>,
    private readonly seed: number,
  ) {}

  /** w, h: world size (lane/ground fractions apply to it); view: visible world rectangle. */
  resize(w: number, h: number, view: View): void {
    this.w = w
    this.h = h
    this.view = view
    this.dirty = true
  }

  render(season: Season, sky: SkyColors): void {
    if (this.w === 0 || this.view.width === 0) return
    if (this.dirty || season !== this.builtSeason) {
      this.build(season)
      this.builtSeason = season
      this.dirty = false
      this.lastTint = -1
    }
    const tint = tintFor(sky)
    if (tint !== this.lastTint || sky.horizon !== this.lastHorizon) {
      this.lastTint = tint
      this.lastHorizon = sky.horizon
      this.def.layers.forEach((layer, i) => {
        const rt = this.textures[i]
        if (!rt) return
        rt.setTint(layer.tint === 'horizon' ? this.horizonTint(tint, sky.horizon) : tint)
      })
    }
  }

  destroy(): void {
    for (const rt of this.textures) rt.destroy()
    this.textures = []
  }

  /** Fog blends into the sky: tint = horizon colour × time-of-day grey. */
  private horizonTint(grey: number, horizon: string): number {
    const k = (grey & 0xff) / 255
    const [r, g, b] = hexToRgb(horizon)
    return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k)
  }

  private tileKey(id: string, season: Season): string {
    return `tile:${id}:${season}`
  }

  private ensureTiles(season: Season): void {
    const palette = this.def.palettes[season]
    for (const tile of Object.values(this.tiles)) {
      const key = this.tileKey(tile.id, season)
      if (this.scene.textures.exists(key)) continue
      const { w, h, rgba } = paintTile(tile, palette)
      const tex = this.scene.textures.createCanvas(key, w, h)
      if (!tex) throw new Error(`cannot create texture ${key}`)
      tex
        .getContext()
        .putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
      tex.refresh()
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
  }

  private build(season: Season): void {
    this.destroy()
    this.ensureTiles(season)
    const { x: vx, y: vy, width: vw, height: vh } = this.view
    const tileScaleBase = Math.min(this.w, this.h) / REFERENCE_SIZE
    const palette = this.def.palettes[season]

    this.textures = this.def.layers.map((layer) => {
      const rt = this.scene.add
        .renderTexture(vx, vy, Math.ceil(vw), Math.ceil(vh))
        .setOrigin(0, 0)
        .setDepth(DEPTH[layer.id])
      if (layer.alpha !== undefined) rt.setAlpha(layer.alpha)
      const tileScale = layer.scale * tileScaleBase
      const baseY = layer.y * this.h - vy

      if (layer.id === 'mid') this.drawGround(rt, palette, tileScale)

      for (const p of planLayer(layer, this.tiles, this.seed, vw, tileScale)) {
        const tile = this.tiles[p.tile]
        const wPx = tile.size[0] * tileScale
        const top = baseY - (tile.ground + 1) * tileScale
        rt.stamp(
          this.tileKey(p.tile, season),
          undefined,
          Math.round(p.x + (p.flip ? wPx : 0)),
          Math.round(top),
          {
            originX: 0,
            originY: 0,
            scaleX: p.flip ? -tileScale : tileScale,
            scaleY: tileScale,
          },
        )
      }
      rt.render()
      return rt
    })
  }

  private drawGround(
    rt: Phaser.GameObjects.RenderTexture,
    palette: Record<string, string>,
    tileScale: number,
  ): void {
    const top = Math.round(this.def.ground.y * this.h - this.view.y)
    const bottom = Math.ceil(this.view.height)
    const height = Math.max(0, bottom - top)
    const width = Math.ceil(this.view.width)
    const line = Math.max(1, Math.round(tileScale * GROUND_LINE_TILES))
    const earthTop = bottom - Math.round(height * EARTH_SHARE)
    rt.fill(toInt(palette.G), 1, 0, top, width, height)
    rt.fill(toInt(palette.g), 1, 0, top, width, line)
    rt.fill(toInt(palette.t), 1, 0, earthTop, width, bottom - earthTop)
    // Grass dither above the line and moss flecks on the band, seeded so layouts stay stable.
    const rng = mulberry32(this.seed + GROUND_SEED_OFFSET)
    const bits = Math.ceil(width / (line * 3))
    for (let i = 0; i < bits; i++) {
      const x = Math.floor(rng() * width)
      const up = line * (1 + Math.floor(rng() * 2))
      rt.fill(toInt(palette.g), 1, x, top - up, line * 2, up)
    }
    const flecks = Math.ceil(width / (line * 6))
    for (let i = 0; i < flecks; i++) {
      const x = Math.floor(rng() * width)
      const y = top + line * 3 + Math.floor(rng() * Math.max(1, earthTop - top - line * 6))
      rt.fill(toInt(rng() < 0.5 ? palette.g : palette.F), 1, x, y, line * 3, line)
    }
  }
}
