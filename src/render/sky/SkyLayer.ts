import Phaser from 'phaser'
import { mulberry32 } from '@domain/rng'
import { lerpHex, type SkyColors } from '@domain/sky/SkyPalette'

const HORIZON_Y = 0.6
const SKYLINE_COUNT = 10
const STAR_COUNT = 30
const MOON_X = 0.78
const MOON_Y = 0.18
const MOON_R = 0.04

interface Block {
  x: number
  w: number
  h: number
}

const toInt = (hex: string): number => parseInt(hex.slice(1), 16)

export class SkyLayer {
  private readonly sky: Phaser.GameObjects.Graphics
  private readonly stars: Phaser.GameObjects.Graphics
  private readonly moon: Phaser.GameObjects.Graphics
  private readonly blocks: Block[] = []
  private readonly starPos: { x: number; y: number }[] = []
  private w = 0
  private h = 0
  private lastColors: SkyColors | null = null
  private lastMoon = -1
  private lastStarAlpha = -1

  constructor(scene: Phaser.Scene, seed: number) {
    const rng = mulberry32(seed)
    for (let i = 0; i < SKYLINE_COUNT; i++) {
      this.blocks.push({
        x: (i + rng() * 0.8) / SKYLINE_COUNT,
        w: 0.04 + rng() * 0.08,
        h: 0.05 + rng() * 0.2,
      })
    }
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starPos.push({ x: rng(), y: rng() * (HORIZON_Y - 0.1) })
    }
    this.sky = scene.add.graphics().setDepth(-30)
    this.stars = scene.add.graphics().setDepth(-20)
    this.moon = scene.add.graphics().setDepth(-10)
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.lastColors = null
    this.lastMoon = -1
    this.drawStars()
  }

  render(c: SkyColors, moonPhase: number): void {
    if (this.w === 0) return
    if (!this.lastColors || !sameColors(this.lastColors, c)) {
      this.drawSky(c)
      this.lastColors = { ...c }
    }
    if (c.starAlpha !== this.lastStarAlpha) {
      this.lastStarAlpha = c.starAlpha
      this.stars.setAlpha(c.starAlpha)
    }
    const q = Math.round(moonPhase * 1000)
    if (q !== this.lastMoon) {
      this.lastMoon = q
      this.drawMoon(moonPhase)
    }
    const lit = 1 - Math.abs(moonPhase - 0.5) * 2
    this.moon.setAlpha(c.starAlpha * (0.35 + 0.65 * lit))
  }

  private drawSky(c: SkyColors): void {
    const { w, h } = this
    const g = this.sky
    g.clear()
    g.fillGradientStyle(toInt(c.top), toInt(c.top), toInt(c.bottom), toInt(c.bottom), 1)
    g.fillRect(0, 0, w, h)
    const horizonY = h * HORIZON_Y
    g.fillStyle(toInt(c.horizon), 1)
    for (const b of this.blocks) g.fillRect(b.x * w, horizonY - b.h * h, b.w * w, b.h * h)
    g.fillStyle(toInt(lerpHex(c.horizon, '#000000', 0.12)), 1)
    g.fillRect(0, horizonY, w, h - horizonY)
  }

  private drawStars(): void {
    const g = this.stars
    g.clear()
    g.fillStyle(0xffffff, 1)
    for (const s of this.starPos)
      g.fillRect(Math.floor(s.x * this.w), Math.floor(s.y * this.h), 2, 2)
  }

  /** Lit part of the disc = disc minus a disc shifted sideways by the shadow offset. */
  private drawMoon(phase: number): void {
    const g = this.moon
    g.clear()
    const r = Math.max(2, Math.round(this.h * MOON_R))
    const cx = Math.round(this.w * MOON_X)
    const cy = Math.round(this.h * MOON_Y)
    const lit = 1 - Math.abs(phase - 0.5) * 2
    const off = (phase < 0.5 ? -1 : 1) * lit * 2 * r
    g.fillStyle(0xf2efe0, 1)
    for (let y = -r; y < r; y++) {
      const a = Math.sqrt(r * r - (y + 0.5) * (y + 0.5))
      const left = off < 0 ? Math.max(-a, off + a) : -a
      const right = off > 0 ? Math.min(a, off - a) : a
      if (right > left) g.fillRect(cx + left, cy + y, right - left, 1)
    }
  }
}

function sameColors(a: SkyColors, b: SkyColors): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.horizon === b.horizon
}
