import Phaser from 'phaser'
import type { Bubble, BubbleQueue } from '@domain/speech/Bubbles'

const POOL = 6
const DEPTH = 2_000_000
const FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif'
const TEXT_COLOR = '#2b2b2b'
const BG_COLOR = 0xf4efe6
const BG_ALPHA = 0.92
const TEXT_PX = 14
const ICON_PX = 18
const PAD_X = 8
const PAD_Y = 5
const RADIUS = 7
const GAP_ABOVE_HEAD = 6
const WRAP_PX = 150
const EDGE = 4
const TAIL_BIG = 3.5
const TAIL_SMALL = 2.2
const TAIL_ROOM = 9

/** World-space anchor of a resident: feet position and displayed sprite height. */
export interface Anchor {
  x: number
  y: number
  height: number
}

export interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

interface Slot {
  g: Phaser.GameObjects.Graphics
  t: Phaser.GameObjects.Text
  /** Bubble id whose text/style is currently applied (empty when none). */
  textId: string
  /** Last Graphics shape key (id, size, tail offset); the shape is drawn in local coordinates. */
  shape: string
}

/** Draws BubbleQueue output above residents' heads; pooled, never allocates per frame. */
export class BubbleLayer {
  private readonly slots: Slot[]

  constructor(
    scene: Phaser.Scene,
    private readonly queue: BubbleQueue,
  ) {
    this.slots = Array.from({ length: POOL }, () => ({
      g: scene.add.graphics().setDepth(DEPTH).setVisible(false),
      t: scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${TEXT_PX}px`, color: TEXT_COLOR })
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH + 1)
        .setVisible(false),
      textId: '',
      shape: '',
    }))
  }

  sync(
    bubbles: Bubble[],
    nowMs: number,
    anchorOf: (residentId: string) => Anchor | undefined,
    view: ViewRect,
  ): void {
    let used = 0
    for (const b of bubbles) {
      const a = anchorOf(b.residentId)
      if (!a || used >= POOL) continue
      this.draw(this.slots[used++], b, this.queue.alphaOf(b, nowMs), a, view)
    }
    for (let i = used; i < POOL; i++) {
      this.slots[i].g.setVisible(false)
      this.slots[i].t.setVisible(false)
    }
  }

  destroy(): void {
    for (const s of this.slots) {
      s.g.destroy()
      s.t.destroy()
    }
  }

  private draw(s: Slot, b: Bubble, alpha: number, a: Anchor, view: ViewRect): void {
    const icon = b.kind === 'icon'
    if (s.textId !== b.id) {
      s.t
        .setStyle({
          fontFamily: FONT,
          fontSize: `${icon ? ICON_PX : TEXT_PX}px`,
          color: TEXT_COLOR,
        })
        .setWordWrapWidth(icon ? 0 : WRAP_PX, true)
        .setAlign('center')
        .setText(b.text)
      s.textId = b.id
    }
    const w = s.t.width + (icon ? 0 : PAD_X * 2)
    const h = s.t.height + (icon ? 0 : PAD_Y * 2)
    const room = b.kind === 'thought' ? TAIL_ROOM : 0
    const bottom = a.y - a.height - GAP_ABOVE_HEAD - room
    const cx = Phaser.Math.Clamp(a.x, view.x + w / 2 + EDGE, view.x + view.width - w / 2 - EDGE)
    const cy = Math.max(view.y + h / 2 + EDGE, bottom - h / 2)
    s.t.setPosition(cx, cy).setAlpha(alpha).setVisible(true)
    s.g.setPosition(cx, cy).setAlpha(alpha).setVisible(!icon)
    if (icon) {
      s.shape = ''
      return
    }
    const hx = Phaser.Math.Clamp(a.x, cx - w / 2 + RADIUS, cx + w / 2 - RADIUS) - cx
    const key = `${b.id}|${w}|${h}|${hx}`
    if (key === s.shape) return
    s.shape = key
    s.g.clear()
    s.g.fillStyle(BG_COLOR, BG_ALPHA).fillRoundedRect(-w / 2, -h / 2, w, h, RADIUS)
    if (b.kind === 'thought') {
      // two small circles trailing toward the head instead of a tail
      s.g.fillCircle(hx, h / 2 + TAIL_BIG + 1, TAIL_BIG)
      s.g.fillCircle(hx, h / 2 + TAIL_BIG * 2 + TAIL_SMALL + 3, TAIL_SMALL)
    } else {
      const y0 = h / 2
      s.g.fillTriangle(hx - 4, y0 - 1, hx + 4, y0 - 1, hx, y0 + 5)
    }
  }
}
