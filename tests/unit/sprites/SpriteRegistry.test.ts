import { describe, expect, it } from 'vitest'
import { FOREST, PARTS, RIGS, SPECIES, TILES } from '../../../src/domain/sprites/catalog'
import { composeFrame } from '../../../src/domain/sprites/Compose'
import { resolveVariant } from '../../../src/domain/sprites/Palette'
import {
  allVariants,
  animKey,
  defaultVariant,
  loadRegistry,
  validateScene,
} from '../../../src/domain/sprites/SpriteRegistry'
import type { Registry } from '../../../src/domain/sprites/SpriteRegistry'
import { FRAME_COUNT, STATES, validateRig } from '../../../src/domain/sprites/validateRig'
import type {
  Frame,
  PartDef,
  RigDef,
  SpeciesDef,
  SpriteState,
} from '../../../src/domain/sprites/types'

function hexToRgbTriple(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

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
    voice: { syllables: ['aa', 'bb'], marks: ['?', '…', '!'], maxSyllables: 2 },
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
    const reg = makeReg({}, { rigs: ['other'] })
    reg.rigs.other = { ...makeRig(), id: 'other' }
    expect(() => loadRegistry(reg)).toThrow(/^species s: .*'test'/)
  })

  it('rejects part with unknown anchor', () => {
    expect(() => loadRegistry(makeReg({}, { anchor: 'wing' }))).toThrow(/^part p: .*anchor 'wing'/)
  })

  it('rejects part listing an unknown rig', () => {
    expect(() => loadRegistry(makeReg({}, { rigs: ['test', 'nope'] }))).toThrow(
      "part p: unknown rig 'nope'",
    )
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

  it('rejects species without voice', () => {
    const reg = makeReg()
    delete (reg.species.s as Partial<SpeciesDef>).voice
    expect(() => loadRegistry(reg)).toThrow(/^species s: .*voice/)
  })

  it('rejects malformed voices', () => {
    const bad = (voice: unknown) =>
      expect(() => loadRegistry(makeReg({ voice } as Partial<SpeciesDef>))).toThrow(
        /^species s: .*voice/,
      )
    const ok = { syllables: ['aa', 'bb'], marks: ['?', '…', '!'], maxSyllables: 2 }
    bad({ ...ok, syllables: ['aa'] })
    bad({ ...ok, syllables: ['aa', ''] })
    bad({ ...ok, syllables: 'aa' })
    bad({ ...ok, marks: [] })
    bad({ ...ok, marks: ['?', '…', ''] })
    bad({ ...ok, marks: ['?', '…'] })
    bad({ ...ok, marks: ['…', '!'] })
    bad({ ...ok, marks: ['?', '…', '.'] })
    bad({ ...ok, maxSyllables: 0 })
    bad({ ...ok, maxSyllables: 5 })
    bad({ ...ok, maxSyllables: 1.5 })
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

  it('every species has a valid voice', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      expect(sp.voice, id).toBeDefined()
      expect(sp.voice.syllables.length, id).toBeGreaterThanOrEqual(2)
      for (const m of ['?', '…', '!']) expect(sp.voice.marks, id).toContain(m)
    }
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

  it('quad-s rig has 14 frames and passes validateRig', () => {
    const rig = RIGS['quad-s']
    expect(() => validateRig(rig)).not.toThrow()
    const total = STATES.reduce((n, s) => n + rig.frames[s].length, 0)
    expect(total).toBe(14)
  })

  it('quad-l rig is 48x40 with 14 frames and passes validateRig', () => {
    const rig = RIGS['quad-l']
    expect(rig.size).toEqual([48, 40])
    expect(() => validateRig(rig)).not.toThrow()
    const total = STATES.reduce((n, s) => n + rig.frames[s].length, 0)
    expect(total).toBe(14)
  })

  it('quad-deer rig is 48x40 with 14 frames and passes validateRig', () => {
    const rig = RIGS['quad-deer']
    expect(rig.size).toEqual([48, 40])
    expect(() => validateRig(rig)).not.toThrow()
    const total = STATES.reduce((n, s) => n + rig.frames[s].length, 0)
    expect(total).toBe(14)
  })

  it('bird rig is 24x24 with 14 frames and passes validateRig', () => {
    const rig = RIGS['bird']
    expect(rig.size).toEqual([24, 24])
    expect(() => validateRig(rig)).not.toThrow()
    const total = STATES.reduce((n, s) => n + rig.frames[s].length, 0)
    expect(total).toBe(14)
  })

  it('biped rig is 24x40 with 14 frames and passes validateRig', () => {
    const rig = RIGS['biped']
    expect(rig.size).toEqual([24, 40])
    expect(() => validateRig(rig)).not.toThrow()
    const total = STATES.reduce((n, s) => n + rig.frames[s].length, 0)
    expect(total).toBe(14)
  })

  it('human variants = 144', () => {
    const human = SPECIES.human
    expect(human.rig).toBe('biped')
    expect(allVariants(human)).toHaveLength(144)
    expect(defaultVariant(human)).toBe('skin-1|adult|short|none|adult')
  })

  it('human composes idle[0] for every variant', () => {
    const human = SPECIES.human
    const rig = RIGS[human.rig]
    for (const variant of allVariants(human)) {
      const buf = composeFrame({
        rig,
        state: 'idle',
        index: 0,
        variant: resolveVariant(human, variant),
        parts: PARTS,
      })
      expect(buf.rgba.length).toBe(24 * 40 * 4)
      let opaque = 0
      for (let i = 3; i < buf.rgba.length; i += 4) if (buf.rgba[i] > 0) opaque++
      expect(opaque, variant).toBeGreaterThan(100)
      const hair = hexToRgbTriple(
        SPECIES.human.palettes[variant.split('|')[0]][variant.includes('|cap|') ? 'm' : 'M'],
      )
      let hairPx = 0
      for (let i = 0; i < buf.rgba.length; i += 4) {
        if (buf.rgba[i + 3] && buf.rgba[i] === hair[0] && buf.rgba[i + 1] === hair[1]) hairPx++
      }
      expect(hairPx, variant).toBeGreaterThan(0)
    }
  })

  it('biped walk frames are six distinct poses and the lead leg swaps', () => {
    const frames = RIGS['biped'].frames.walk
    expect(new Set(frames.map((f) => f.rows.join('/'))).size).toBe(6)
    const lead = (rows: string[]): 'L' | 'l' => {
      const row = rows[37]
      return row.lastIndexOf('L') > row.lastIndexOf('l') ? 'L' : 'l'
    }
    expect(lead(frames[0].rows)).toBe('L')
    expect(lead(frames[3].rows)).toBe('l')
  })

  it('human trouser colours differ per palette and no palette is olive-drab', () => {
    const pals = Object.values(SPECIES.human.palettes)
    expect(new Set(pals.map((p) => p.L)).size).toBe(4)
    expect(new Set(pals.map((p) => p.W)).size).toBe(4)
  })

  it('the six mountain birds use the bird rig', () => {
    for (const id of ['carrion-crow', 'magpie', 'eagle-owl', 'woodpecker', 'jay', 'pheasant']) {
      expect(SPECIES[id]?.rig, id).toBe('bird')
    }
    expect(SPECIES['eagle-owl']?.nocturnal).toBe(true)
  })

  it('heavy species use quad-l and deer species use quad-deer', () => {
    for (const id of ['black-bear', 'wild-boar', 'goral']) {
      expect(SPECIES[id]?.rig, id).toBe('quad-l')
    }
    for (const id of ['water-deer', 'roe-deer']) {
      expect(SPECIES[id]?.rig, id).toBe('quad-deer')
    }
  })

  it('every species composes every state frame 0 for its default variant', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      const variant = resolveVariant(sp, defaultVariant(sp))
      for (const state of STATES) {
        const buf = composeFrame({ rig: RIGS[sp.rig], state, index: 0, variant, parts: PARTS })
        const opaque = buf.rgba.some((v, i) => i % 4 === 3 && v === 255)
        expect(opaque, `${id} ${state}`).toBe(true)
      }
    }
  })

  it('composed sprite is a single connected blob', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      const rig = RIGS[sp.rig]
      const variant = resolveVariant(sp, defaultVariant(sp))
      // every state the rig carries, including the M2b states that not all rigs have yet
      for (const state of Object.keys(rig.frames) as SpriteState[]) {
        rig.frames[state]?.forEach((_, index) => {
          const { w, h, rgba } = composeFrame({ rig, state, index, variant, parts: PARTS })
          expect(countComponents(rgba, w, h), `${id} ${state}[${index}]`).toBe(1)
        })
      }
    }
  })
})

/** Number of 8-connected opaque components in an RGBA buffer. */
function countComponents(rgba: Uint8ClampedArray, w: number, h: number): number {
  const seen = new Uint8Array(w * h)
  let count = 0
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || rgba[start * 4 + 3] === 0) continue
    count++
    const stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const cur = stack.pop() as number
      const cx = cur % w
      const cy = (cur - cx) / w
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (seen[n] || rgba[n * 4 + 3] === 0) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }
  }
  return count
}

describe('validateScene', () => {
  it('accepts the real forest scene and tiles', () => {
    expect(() => validateScene(FOREST, TILES)).not.toThrow()
  })

  it('rejects a palette missing a used role', () => {
    const bad = structuredClone(FOREST)
    delete bad.palettes.winter.G
    expect(() => validateScene(bad, TILES)).toThrow(/role 'G'/)
  })

  it('rejects min greater than max', () => {
    const bad = structuredClone(FOREST)
    bad.layers[1].tiles[2].min = 3
    bad.layers[1].tiles[2].max = 1
    expect(() => validateScene(bad, TILES)).toThrow(/min 3 greater than max 1/)
  })

  it('rejects mins that exceed the slots and ground outside rows', () => {
    const many = structuredClone(FOREST)
    many.layers[1].density = 0.05
    many.layers[1].tiles.forEach((t) => (t.min = 1))
    expect(() => validateScene(many, TILES)).toThrow(/slots/)
    const badTiles = structuredClone(TILES)
    badTiles['trunk-moss-a'].ground = 999
    expect(() => validateScene(FOREST, badTiles)).toThrow(/ground/)
  })

  it('rejects unknown tiles, bad layer order and out-of-range values', () => {
    const noTile = structuredClone(FOREST)
    noTile.layers[0].tiles[0].id = 'nope'
    expect(() => validateScene(noTile, TILES)).toThrow(/^scene: /)
    const order = structuredClone(FOREST)
    order.layers.reverse()
    expect(() => validateScene(order, TILES)).toThrow(/^scene: /)
    const dens = structuredClone(FOREST)
    dens.layers[1].density = 1.5
    expect(() => validateScene(dens, TILES)).toThrow(/density/)
    const y = structuredClone(FOREST)
    y.layers[1].y = 2
    expect(() => validateScene(y, TILES)).toThrow(/ y /)
    const g = structuredClone(FOREST)
    g.ground.y = -1
    expect(() => validateScene(g, TILES)).toThrow(/ground/)
  })
})
