import Phaser from 'phaser'
import { composeLayer, multiplyBuffer, planLayer, tintFor } from '@domain/background/ForestPlan'
import type { SkyColors } from '@domain/sky/SkyPalette'
import { hexToRgb } from '@domain/sprites/Palette'
import type { FrameBuffer } from '@domain/sprites/Compose'
import type { SceneDef, SceneLayer, TileDef } from '@domain/sprites/types'
import type { Season } from '@domain/time/DateContext'
import type { View } from '../sky/SkyLayer'

const DEPTH: Record<SceneLayer['id'], number> = { back: -5, mid: -3, front: 5000 }
const REFERENCE_SIZE = 360
/** Rows of grass dither kept above the ground line inside the mid buffer. */
const GROUND_HEADROOM = 3
/** The baked back-layer fog is rebuilt when the horizon colour drifts by more than this. */
const HORIZON_REBAKE = 6

interface LayerBuf {
  buf: FrameBuffer
  scale: number
  /** Screen (view-relative) y of the buffer's top row. */
  top: number
}

/**
 * Draws the mossy forest as two static images: back+mid baked into one (the back layer's alpha
 * and horizon fog are baked in, rebuilt when the horizon colour drifts), and the front layer.
 * Layers are composed at native tile resolution and scaled with NEAREST. The time-of-day grey
 * is applied through the image tint.
 */
export class ForestLayer {
  private backMid: Phaser.GameObjects.Image | null = null
  private front: Phaser.GameObjects.Image | null = null
  private backMidTex: Phaser.Textures.CanvasTexture | null = null
  private keys: string[] = []
  private backSrc: LayerBuf | null = null
  private midCanvas: HTMLCanvasElement | null = null
  private backAlpha = 1
  private bakedHorizon: [number, number, number] | null = null
  private w = 0
  private h = 0
  private view: View = { x: 0, y: 0, width: 0, height: 0 }
  private builtSeason: Season | null = null
  private dirty = true
  private tints: number[] = [-1, -1]

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
    const horizon = hexToRgb(sky.horizon)
    if (this.dirty || season !== this.builtSeason) {
      this.build(season)
      this.builtSeason = season
      this.dirty = false
      this.bakeBackMid(horizon)
      this.tints = [-1, -1]
    } else if (this.horizonDrifted(horizon)) {
      this.bakeBackMid(horizon)
    }
    const tint = tintFor(sky)
    ;[this.backMid, this.front].forEach((img, i) => {
      if (!img || this.tints[i] === tint) return
      this.tints[i] = tint
      img.setTint(tint)
    })
  }

  destroy(): void {
    this.backMid?.destroy()
    this.front?.destroy()
    for (const key of this.keys)
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    this.backMid = null
    this.front = null
    this.backMidTex = null
    this.backSrc = null
    this.midCanvas = null
    this.bakedHorizon = null
    this.keys = []
  }

  private horizonDrifted(h: [number, number, number]): boolean {
    const b = this.bakedHorizon
    return (
      !b ||
      Math.max(Math.abs(b[0] - h[0]), Math.abs(b[1] - h[1]), Math.abs(b[2] - h[2])) > HORIZON_REBAKE
    )
  }

  private composeOf(layer: SceneLayer, season: Season): LayerBuf {
    const { y: vy, width: vw, height: vh } = this.view
    const palette = this.def.palettes[season]
    const scale = layer.scale * (Math.min(this.w, this.h) / REFERENCE_SIZE)
    const widthPx = Math.ceil(vw / scale)
    const baseY = layer.y * this.h - vy // ground line of this layer, view-relative screen px
    const defs = layer.tiles.map((e) => this.tiles[e.id])
    let above = Math.max(...defs.map((t) => t.ground + 1))
    const below = Math.max(...defs.map((t) => t.size[1] - t.ground - 1))
    let groundRow: number | undefined
    let bottomRows = below
    if (layer.id === 'mid') {
      const groundTop = this.def.ground.y * this.h - vy
      above = Math.max(above, Math.ceil((baseY - groundTop) / scale) + GROUND_HEADROOM)
      bottomRows = Math.max(below, Math.ceil((vh - baseY) / scale))
      groundRow = above - Math.round((baseY - groundTop) / scale)
    }
    const heightPx = above + bottomRows
    const buf = composeLayer({
      placements: planLayer(layer, this.tiles, this.seed, widthPx, 1),
      tiles: this.tiles,
      palette,
      widthPx,
      heightPx,
      layerRow: above,
      groundRow,
      groundPalette:
        groundRow === undefined
          ? undefined
          : { G: palette.G, g: palette.g, t: palette.t, F: palette.F },
      seed: this.seed,
    })
    return { buf, scale, top: Math.round(baseY - above * scale) }
  }

  private toCanvas(buf: FrameBuffer): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = buf.w
    c.height = buf.h
    c.getContext('2d')!.putImageData(
      new ImageData(buf.rgba as Uint8ClampedArray<ArrayBuffer>, buf.w, buf.h),
      0,
      0,
    )
    return c
  }

  private canvasTexture(key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    const tex = this.scene.textures.createCanvas(key, w, h)
    if (!tex) throw new Error(`cannot create texture ${key}`)
    this.keys.push(key)
    return tex
  }

  private build(season: Season): void {
    this.destroy()
    const { x: vx, y: vy, width: vw, height: vh } = this.view
    const W = Math.ceil(vw)
    const H = Math.ceil(vh)
    const byId = (id: SceneLayer['id']): SceneLayer => this.def.layers.find((l) => l.id === id)!
    const backLayer = byId('back')
    this.backAlpha = backLayer.alpha ?? 1
    this.backSrc = this.composeOf(backLayer, season)
    const mid = this.composeOf(byId('mid'), season)
    this.midCanvas = document.createElement('canvas')
    this.midCanvas.width = W
    this.midCanvas.height = H
    const mctx = this.midCanvas.getContext('2d')!
    mctx.imageSmoothingEnabled = false
    mctx.drawImage(this.toCanvas(mid.buf), 0, mid.top, mid.buf.w * mid.scale, mid.buf.h * mid.scale)

    const tex = this.canvasTexture(`forest:backmid:${season}:${W}x${H}`, W, H)
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
    this.backMidTex = tex
    this.backMid = this.scene.add.image(vx, vy, tex.key).setOrigin(0, 0).setDepth(DEPTH.mid)

    const front = this.composeOf(byId('front'), season)
    const ftex = this.canvasTexture(
      `forest:front:${season}:${front.buf.w}x${front.buf.h}`,
      front.buf.w,
      front.buf.h,
    )
    ftex
      .getContext()
      .putImageData(
        new ImageData(front.buf.rgba as Uint8ClampedArray<ArrayBuffer>, front.buf.w, front.buf.h),
        0,
        0,
      )
    ftex.refresh()
    ftex.setFilter(Phaser.Textures.FilterMode.NEAREST)
    this.front = this.scene.add
      .image(vx, vy + front.top, ftex.key)
      .setOrigin(0, 0)
      .setScale(front.scale)
      .setDepth(DEPTH.front)
  }

  /** Bakes back (alpha + horizon fog) under mid into the back+mid texture. */
  private bakeBackMid(horizon: [number, number, number]): void {
    if (!this.backSrc || !this.midCanvas || !this.backMidTex) return
    const { buf, scale, top } = this.backSrc
    const fog: FrameBuffer = { w: buf.w, h: buf.h, rgba: new Uint8ClampedArray(buf.rgba) }
    multiplyBuffer(fog, horizon)
    const ctx = this.backMidTex.getContext()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = this.backAlpha
    ctx.drawImage(this.toCanvas(fog), 0, top, buf.w * scale, buf.h * scale)
    ctx.globalAlpha = 1
    ctx.drawImage(this.midCanvas, 0, 0)
    this.backMidTex.refresh()
    this.bakedHorizon = horizon
  }
}
