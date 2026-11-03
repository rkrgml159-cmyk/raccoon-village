import { describe, expect, it } from 'vitest'
import { PARTS, RIGS, SPECIES } from '../../../src/domain/sprites/catalog'
import { composeFrame } from '../../../src/domain/sprites/Compose'
import { resolveVariant } from '../../../src/domain/sprites/Palette'
import { parsePixelMap, SPRITE_ROLES } from '../../../src/domain/sprites/PixelMap'
import {
  allVariants,
  animKey,
  defaultVariant,
  loadRegistry,
} from '../../../src/domain/sprites/SpriteRegistry'
import type { Registry } from '../../../src/domain/sprites/SpriteRegistry'
import { FRAME_COUNT, STATES } from '../../../src/domain/sprites/validateRig'
import type {
  Frame,
  PartDef,
  RigDef,
  SpeciesDef,
  SpriteState,
} from '../../../src/domain/sprites/types'

function blankFrame(): Frame {
  return {
    rows: Array.from({ length: 8 }, (_, y) => (y === 0 ? 'BbWLlDEP' : '.'.repeat(8))),
    anchors: { head: [4, 2], ears: [5, 1], tail: [1, 4], back: [3, 1], front: [6, 7] },
  }
}

function makeRig(): RigDef {
  const frames = {} as Record<SpriteState, Frame[]>
  for (const s of STATES) frames[s] = Array.from({ length: FRAME_COUNT[s] }, blankFrame)
  return { id: 'test', size: [8, 8], frames, frameRate: { idle: 2, walk: 8, sit: 2, sleep: 1 } }
}

const ROLES = 'BbWLlDEPNMmH'.split('')
function fullPalette(): Record<string, string> {
  return Object.fromEntries(ROLES.map((r) => [r, '#808080']))
}

function makePart(over: Partial<PartDef> = {}): PartDef {
  return {
    id: 'p',
    rigs: ['test'],
    anchor: 'head',
    layer: 'above',
    offset: [0, 0],
    rows: ['M'],
    ...over,
  }
}

function makeSpecies(over: Partial<SpeciesDef> = {}): SpeciesDef {
  return {
    name: 's',
    rig: 'test',
    scale: 1,
    share: 1,
    palettes: { a: fullPalette(), b: fullPalette() },
    overlays: ['p'],
    ...over,
  }
}

function makeReg(sp: Partial<SpeciesDef> = {}, part: Partial<PartDef> = {}): Registry {
  return {
    rigs: { test: makeRig() },
    parts: { p: makePart(part) },
    species: { s: makeSpecies(sp) },
  }
}

describe('loadRegistry', () => {
  it('accepts a valid registry and returns it', () => {
    const reg = makeReg()
    expect(loadRegistry(reg)).toBe(reg)
  })

  it('rejects species with unknown rig', () => {
    expect(() => loadRegistry(makeReg({ rig: 'nope' }))).toThrow(/^species s: .*rig/)
  })

  it('rejects a species whose rig is invalid', () => {
    const reg = makeReg()
    reg.rigs.test.frames.idle = []
    expect(() => loadRegistry(reg)).toThrow(/rig test/)
  })

  it('rejects overlay referencing missing part', () => {
    expect(() => loadRegistry(makeReg({ overlays: ['ghost'] }))).toThrow(
      /^species s: .*part 'ghost'/,
    )
  })

  it('rejects axes referencing missing part', () => {
    const axes = {
      kind: { k: ['ghost'] },
      mask: { m: [] },
      tail: { t: [] },
      body: { normal: 1 },
    }
    expect(() => loadRegistry(makeReg({ axes }))).toThrow(/^species s: .*part 'ghost'/)
  })

  it('rejects part not allowed on rig', () => {
    expect(() => loadRegistry(makeReg({}, { rigs: ['other'] }))).toThrow(/^species s: .*'test'/)
  })

  it('rejects part with unknown anchor', () => {
    expect(() => loadRegistry(makeReg({}, { anchor: 'wing' }))).toThrow(/^part p: .*anchor 'wing'/)
  })

  it('rejects part with malformed rows', () => {
    expect(() => loadRegistry(makeReg({}, { rows: ['M', 'MM'] }))).toThrow(/^part p: /)
  })

  it('rejects part state override with malformed rows', () => {
    const states = { sit: { offset: [0, 0] as [number, number], rows: ['Z'] } }
    expect(() => loadRegistry(makeReg({}, { states }))).toThrow(/^part p: /)
  })

  it('rejects palette missing a role used by a part', () => {
    const pal = fullPalette()
    delete pal.M
    expect(() => loadRegistry(makeReg({ palettes: { a: pal } }))).toThrow(
      /^species s: palette a .*'M'/,
    )
  })

  it('rejects palette missing a role used by the rig body', () => {
    const pal = fullPalette()
    delete pal.B
    expect(() => loadRegistry(makeReg({ palettes: { a: pal } }))).toThrow(/'B'/)
  })

  it('does not require a palette entry for X', () => {
    const reg = makeReg({}, { rows: ['X'], fixed: '#d9a441' })
    expect(() => loadRegistry(reg)).not.toThrow()
  })

  it('does not require palette roles from parts the species cannot use', () => {
    const reg = makeReg()
    reg.parts.unused = makePart({ id: 'unused', rows: ['X'] })
    const pal = fullPalette()
    delete pal.M
    reg.species.s.palettes = { a: pal }
    reg.species.s.overlays = []
    expect(() => loadRegistry(reg)).not.toThrow()
  })

  it('rejects scale out of range', () => {
    expect(() => loadRegistry(makeReg({ scale: 2.5 }))).toThrow(/^species s: .*scale/)
    expect(() => loadRegistry(makeReg({ scale: 0.1 }))).toThrow(/^species s: .*scale/)
  })

  it('rejects bad hex', () => {
    const pal = { ...fullPalette(), B: 'red' }
    expect(() => loadRegistry(makeReg({ palettes: { a: pal } }))).toThrow(/^species s: .*hex/)
  })

  it('rejects negative share', () => {
    expect(() => loadRegistry(makeReg({ share: -1 }))).toThrow(/^species s: .*share/)
  })

  it('rejects lanes that do not sum to 1', () => {
    expect(() => loadRegistry(makeReg({ lanes: [0.3, 0.3, 0.3] }))).toThrow(/^species s: .*lanes/)
    expect(() => loadRegistry(makeReg({ lanes: [0.3, 0.4, 0.3] }))).not.toThrow()
  })
})

describe('variants', () => {
  function axisSpecies(): SpeciesDef {
    return makeSpecies({
      overlays: [],
      axes: {
        kind: { x: [], y: [] },
        mask: { m: [], n: [] },
        tail: { t: [] },
        body: { normal: 1 },
      },
    })
  }

  it('animKey joins species, variant and state', () => {
    expect(animKey('raccoon', 'grey|common|default|5|normal', 'idle')).toBe(
      'spr:raccoon:grey|common|default|5|normal:idle',
    )
  })

  it('defaultVariant uses first palette and first key of each axis', () => {
    expect(defaultVariant(axisSpecies())).toBe('a|x|m|t|normal')
  })

  it('defaultVariant of an axis-less species is its first palette', () => {
    expect(defaultVariant(makeSpecies())).toBe('a')
  })

  it('allVariants is the cartesian product, default first', () => {
    const sp = axisSpecies()
    const all = allVariants(sp)
    expect(all).toHaveLength(2 * 2 * 2 * 1 * 1)
    expect(all[0]).toBe(defaultVariant(sp))
    expect(new Set(all).size).toBe(all.length)
  })

  it('allVariants of an axis-less species lists palettes', () => {
    expect(allVariants(makeSpecies())).toEqual(['a', 'b'])
  })
})

describe('real data', () => {
  const registry: Registry = { rigs: RIGS, parts: PARTS, species: SPECIES }

  it('loads without throwing', () => {
    expect(() => loadRegistry(registry)).not.toThrow()
  })

  it('defines raccoon axes and 1152 variants', () => {
    const raccoon = SPECIES.raccoon
    expect(raccoon.axes).toBeDefined()
    expect(allVariants(raccoon)).toHaveLength(1152)
    expect(defaultVariant(raccoon)).toBe('grey|common|default|3|normal')
  })

  it('composes idle[0] for every raccoon variant', () => {
    const raccoon = SPECIES.raccoon
    const rig = RIGS[raccoon.rig]
    for (const variant of allVariants(raccoon)) {
      const buf = composeFrame({
        rig,
        state: 'idle',
        index: 0,
        variant: resolveVariant(raccoon, variant),
        parts: PARTS,
      })
      expect(buf.rgba.length).toBe(32 * 32 * 4)
    }
  })

  it('keeps every part on the body silhouette in every raccoon frame', () => {
    const raccoon = SPECIES.raccoon
    const rig = RIGS[raccoon.rig]
    const ids = new Set([...(raccoon.overlays ?? [])])
    for (const group of Object.values(raccoon.axes ?? {})) {
      if (typeof Object.values(group)[0] === 'number') continue
      for (const list of Object.values(group as Record<string, string[]>)) {
        list.forEach((id) => ids.add(id))
      }
    }
    for (const id of ids) {
      const part = PARTS[id]
      for (const state of STATES) {
        const v = part.states?.[state] ?? part
        const map = parsePixelMap(v.rows, [v.rows[0].length, v.rows.length], SPRITE_ROLES)
        rig.frames[state].forEach((frame, i) => {
          const body = parsePixelMap(frame.rows, rig.size, SPRITE_ROLES)
          const [ax, ay] = frame.anchors[part.anchor]
          for (let y = 0; y < map.h; y++) {
            for (let x = 0; x < map.w; x++) {
              if (map.cells[y * map.w + x] === '.') continue
              const px = ax + v.offset[0] + x
              const py = ay + v.offset[1] + y
              const cell = body.cells[py * body.w + px]
              expect(cell, `${id} ${state}[${i}] at ${px},${py}`).toBeDefined()
              expect(cell, `${id} ${state}[${i}] at ${px},${py}`).not.toBe('.')
            }
          }
        })
      }
    }
  })
})
