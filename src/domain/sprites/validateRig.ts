import { parsePixelMap, SPRITE_ROLES } from './PixelMap'
import type { RigDef, SpriteState } from './types'

export const STATES: readonly SpriteState[] = ['idle', 'walk', 'sit', 'sleep']

export const FRAME_COUNT: Record<SpriteState, number> = { idle: 4, walk: 6, sit: 2, sleep: 2 }

/** Throws `rig <id>: …` when the rig breaks frame count, pixel, anchor or frame-rate rules. */
export function validateRig(rig: RigDef): void {
  const fail = (msg: string): never => {
    throw new Error(`rig ${rig.id}: ${msg}`)
  }
  const [w, h] = rig.size
  let anchorNames: string[] | null = null

  for (const state of STATES) {
    const frames = rig.frames[state] ?? []
    if (frames.length !== FRAME_COUNT[state]) {
      fail(`${state}: expected ${FRAME_COUNT[state]} frames, got ${frames.length}`)
    }
    frames.forEach((frame, i) => {
      const where = `${state}[${i}]`
      try {
        parsePixelMap(frame.rows, rig.size, SPRITE_ROLES)
      } catch (e) {
        fail(`${where}: ${(e as Error).message}`)
      }
      const names = Object.keys(frame.anchors).sort()
      if (anchorNames === null) anchorNames = names
      else if (names.join(',') !== anchorNames.join(',')) {
        fail(`${where}: anchors [${names.join(',')}] differ from [${anchorNames.join(',')}]`)
      }
      for (const [name, [x, y]] of Object.entries(frame.anchors)) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= w || y < 0 || y >= h) {
          fail(`${where}: anchor ${name} [${x},${y}] outside ${w}x${h}`)
        }
      }
    })
  }

  for (const state of STATES) {
    const rate = rig.frameRate?.[state]
    if (!(typeof rate === 'number' && rate > 0)) fail(`frameRate.${state} must be positive`)
  }
}
