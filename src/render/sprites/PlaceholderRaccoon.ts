import Phaser from 'phaser'

export const RACCOON_KEYS = {
  idle: ['raccoon-idle-0', 'raccoon-idle-1', 'raccoon-idle-2', 'raccoon-idle-3'],
  walk: [
    'raccoon-walk-0',
    'raccoon-walk-1',
    'raccoon-walk-2',
    'raccoon-walk-3',
    'raccoon-walk-4',
    'raccoon-walk-5',
  ],
  sit: ['raccoon-sit-0', 'raccoon-sit-1'],
} as const

const W = 48
const H = 40

const COLOR = {
  body: 0x8a8f99,
  dark: 0x2b2b2b,
  muzzle: 0xe9e4d8,
  leg: 0x55585f,
}

interface Pose {
  /** Body height multiplier (sit = 0.7). */
  bodyScale: number
  /** Vertical shift of the whole figure, px (negative = up). */
  dy: number
  /** Front/back leg x offsets, px. */
  legFront: number
  legBack: number
  eyesClosed: boolean
  /** Tail tip x sway, px. */
  tailTip: number
  /** Tail curls forward over the feet. */
  tailForward: boolean
}

const BASE: Pose = {
  bodyScale: 1,
  dy: 0,
  legFront: 0,
  legBack: 0,
  eyesClosed: false,
  tailTip: 0,
  tailForward: false,
}

function drawRaccoon(g: Phaser.GameObjects.Graphics, p: Pose): void {
  const bodyH = Math.round(14 * p.bodyScale)
  const legH = p.bodyScale < 1 ? 2 : 6
  const feetY = H + p.dy
  const bodyTop = feetY - legH - bodyH
  const bodyBottom = feetY - legH

  // Tail with stripes (behind, left) or curled forward (sit).
  if (p.tailForward) {
    g.fillStyle(COLOR.body, 1).fillRect(26, feetY - 5, 18, 5)
    g.fillStyle(COLOR.dark, 1)
    g.fillRect(30, feetY - 5, 2, 5)
    g.fillRect(36, feetY - 5, 2, 5)
    g.fillRect(42 + p.tailTip, feetY - 5, 2, 5)
  } else {
    const ty = bodyTop + 3
    g.fillStyle(COLOR.body, 1).fillRect(1, ty, 14, 6)
    g.fillStyle(COLOR.dark, 1)
    g.fillRect(4, ty, 2, 6)
    g.fillRect(9, ty, 2, 6)
    g.fillRect(1 + p.tailTip, ty, 3, 6)
  }

  // Legs.
  g.fillStyle(COLOR.leg, 1)
  g.fillRect(14 + p.legBack, bodyBottom, 4, legH)
  g.fillRect(18 + p.legBack, bodyBottom, 4, legH)
  g.fillRect(28 + p.legFront, bodyBottom, 4, legH)
  g.fillRect(32 + p.legFront, bodyBottom, 4, legH)

  // Body.
  g.fillStyle(COLOR.body, 1).fillRect(12, bodyTop, 24, bodyH)

  // Head (right side), ears, mask, muzzle, eye.
  const headTop = bodyTop - 8
  g.fillStyle(COLOR.body, 1).fillRect(30, headTop, 14, 12)
  g.fillRect(31, headTop - 3, 4, 3)
  g.fillRect(39, headTop - 3, 4, 3)
  g.fillStyle(COLOR.dark, 1).fillRect(32, headTop + 3, 12, 4)
  g.fillStyle(COLOR.muzzle, 1).fillRect(40, headTop + 7, 6, 4)
  g.fillStyle(COLOR.dark, 1).fillRect(45, headTop + 7, 2, 2)
  if (p.eyesClosed) {
    g.fillStyle(COLOR.muzzle, 1).fillRect(38, headTop + 5, 4, 1)
  } else {
    g.fillStyle(COLOR.muzzle, 1).fillRect(38, headTop + 4, 3, 3)
    g.fillStyle(COLOR.dark, 1).fillRect(39, headTop + 5, 1, 1)
  }
}

function poses(): Record<string, Pose> {
  const out: Record<string, Pose> = {}
  const tail = [0, 1, 0, -1]
  for (let i = 0; i < 4; i++) {
    out[RACCOON_KEYS.idle[i]] = { ...BASE, eyesClosed: i === 1 || i === 3, tailTip: tail[i] * 2 }
  }
  for (let i = 0; i < 6; i++) {
    const swing = [-3, -2, 0, 3, 2, 0][i]
    out[RACCOON_KEYS.walk[i]] = {
      ...BASE,
      legFront: swing,
      legBack: -swing,
      dy: i % 2 === 0 ? -2 : 0,
      tailTip: swing > 0 ? 1 : -1,
    }
  }
  for (let i = 0; i < 2; i++) {
    out[RACCOON_KEYS.sit[i]] = {
      ...BASE,
      bodyScale: 0.7,
      tailForward: true,
      tailTip: i === 1 ? 1 : 0,
      eyesClosed: i === 1,
    }
  }
  return out
}

export function generateRaccoonTextures(scene: Phaser.Scene): void {
  for (const [key, pose] of Object.entries(poses())) {
    if (scene.textures.exists(key)) continue
    const g = scene.add.graphics()
    drawRaccoon(g, pose)
    g.generateTexture(key, W, H)
    g.destroy()
  }
}

export function registerRaccoonAnims(scene: Phaser.Scene): void {
  const defs: [string, readonly string[], number][] = [
    ['raccoon-idle', RACCOON_KEYS.idle, 4],
    ['raccoon-walk', RACCOON_KEYS.walk, 8],
    ['raccoon-sit', RACCOON_KEYS.sit, 2],
  ]
  for (const [key, frames, frameRate] of defs) {
    if (scene.anims.exists(key)) continue
    scene.anims.create({
      key,
      frames: frames.map((k) => ({ key: k })),
      frameRate,
      repeat: -1,
    })
  }
}
