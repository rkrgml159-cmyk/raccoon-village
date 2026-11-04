import { parsePixelMap, SPRITE_ROLES } from './PixelMap'
import type { M1State, M2bState, RigDef, SpriteState } from './types'

export const STATES: readonly M1State[] = ['idle', 'walk', 'sit', 'sleep']

export const FRAME_COUNT: Record<M1State, number> = { idle: 4, walk: 6, sit: 2, sleep: 2 }

export const FRAME_COUNT_M2B: Record<M2bState, number> = {
  shake: 4,
  interact_a: 4,
  interact_b: 4,
  happy: 2,
  sulk: 2,
}

/** Throws `rig <id>: …` when the rig breaks frame count, pixel, anchor or frame-rate rules. */
export function validateRig(
  rig: RigDef,
  states: readonly SpriteState[] = STATES,
  counts: Record<string, number> = FRAME_COUNT,
): void {
  const fail = (msg: string): never => {
    throw new Error(`rig ${rig.id}: ${msg}`)
  }
  const [w, h] = rig.size
  let anchorNames: string[] | null = null

  for (const state of states) {
    const frames = rig.frames[state] ?? []
    if (frames.length !== counts[state]) {
      fail(`${state}: expected ${counts[state]} frames, got ${frames.length}`)
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

  for (const state of states) {
    const rate = rig.frameRate?.[state]
    if (!(typeof rate === 'number' && rate > 0)) fail(`frameRate.${state} must be positive`)
  }
}
