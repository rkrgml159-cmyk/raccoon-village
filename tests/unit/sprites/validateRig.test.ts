import { describe, expect, it } from 'vitest'
import rigJson from '../../../data/sprites/rigs/raccoon.json'
import { usedRoles, parsePixelMap, SPRITE_ROLES } from '../../../src/domain/sprites/PixelMap'
import { FRAME_COUNT, STATES, validateRig } from '../../../src/domain/sprites/validateRig'
import type { Frame, RigDef, SpriteState } from '../../../src/domain/sprites/types'

function blankFrame(): Frame {
  return {
    rows: Array.from({ length: 32 }, () => '.'.repeat(32)),
    anchors: { head: [20, 10], tail: [6, 14], back: [16, 8], front: [22, 24] },
  }
}

function makeRig(overrides: Partial<RigDef> = {}): RigDef {
  const frames = {} as Record<SpriteState, Frame[]>
  for (const s of STATES) frames[s] = Array.from({ length: FRAME_COUNT[s] }, blankFrame)
  return {
    id: 'test',
    size: [32, 32],
    frames,
    frameRate: { idle: 2, walk: 8, sit: 2, sleep: 1 },
    ...overrides,
  }
}

describe('validateRig', () => {
  it('accepts a well-formed rig', () => {
    expect(() => validateRig(makeRig())).not.toThrow()
  })

  it('rejects wrong frame count', () => {
    const rig = makeRig()
    rig.frames.idle = rig.frames.idle.slice(0, 3)
    expect(() => validateRig(rig)).toThrow(/idle: expected 4 frames/)
  })

  it('rejects anchor set mismatch', () => {
    const rig = makeRig()
    delete rig.frames.walk[0].anchors.tail
    expect(() => validateRig(rig)).toThrow(/anchors/)
  })

  it('rejects anchor outside canvas', () => {
    const rig = makeRig()
    rig.frames.idle[0].anchors.head = [40, 10]
    expect(() => validateRig(rig)).toThrow(/head/)
  })

  it('rejects bad pixel rows', () => {
    const rig = makeRig()
    rig.frames.idle[0].rows[0] = '.'.repeat(31)
    expect(() => validateRig(rig)).toThrow(/row 0/)
  })

  it('rejects non-positive frame rate', () => {
    const rig = makeRig({ frameRate: { idle: 2, walk: 0, sit: 2, sleep: 1 } })
    expect(() => validateRig(rig)).toThrow(/frameRate/)
  })

  it('raccoon.json passes validateRig', () => {
    const rig = rigJson as unknown as RigDef
    expect(() => validateRig(rig)).not.toThrow()
    const roles = usedRoles(parsePixelMap(rig.frames.idle[0].rows, rig.size, SPRITE_ROLES))
    for (const r of ['B', 'D', 'W', 'E', 'P', 'N', 'L']) expect(roles.has(r)).toBe(true)
    for (const r of ['M', 'm']) expect(roles.has(r)).toBe(false)
  })
})
