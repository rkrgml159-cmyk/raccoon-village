import { parsePixelMap, SPRITE_ROLES, TILE_ROLES, usedRoles } from './PixelMap'
import type { PartDef, RigDef, SceneDef, SpeciesDef, SpriteState, TileDef } from './types'
import { STATES, validateRig } from './validateRig'

export interface Registry {
  rigs: Record<string, RigDef>
  parts: Record<string, PartDef>
  species: Record<string, SpeciesDef>
}

const SCALE_MIN = 0.3
const SCALE_MAX = 2.0
const LANE_TOLERANCE = 0.001
const HEX = /^#[0-9a-fA-F]{6}$/
const FIXED_ROLE = 'X'

function partRoles(part: PartDef): Set<string> {
  const roles = new Set<string>()
  const variants = [part, ...Object.values(part.states ?? {})]
  for (const v of variants) {
    const map = parsePixelMap(v.rows, [v.rows[0]?.length ?? 0, v.rows.length], SPRITE_ROLES)
    for (const r of usedRoles(map)) roles.add(r)
  }
  return roles
}

function rigRoles(rig: RigDef): Set<string> {
  const roles = new Set<string>()
  for (const state of STATES) {
    for (const frame of rig.frames[state]) {
      for (const r of usedRoles(parsePixelMap(frame.rows, rig.size, SPRITE_ROLES))) roles.add(r)
    }
  }
  return roles
}

function validatePart(part: PartDef, rigs: Record<string, RigDef>): void {
  const fail = (msg: string): never => {
    throw new Error(`part ${part.id}: ${msg}`)
  }
  try {
    partRoles(part)
  } catch (e) {
    fail((e as Error).message)
  }
  if (part.fixed !== undefined && !HEX.test(part.fixed)) fail(`invalid hex color '${part.fixed}'`)
  for (const rigId of part.rigs) {
    const rig = rigs[rigId]
    if (!rig) continue
    for (const state of STATES) {
      rig.frames[state].forEach((frame, i) => {
        if (!(part.anchor in frame.anchors)) {
          fail(`anchor '${part.anchor}' missing in rig ${rigId} ${state}[${i}]`)
        }
      })
    }
  }
}

/** Every part id a species can draw: fixed overlays plus every axis choice. */
function usablePartIds(sp: SpeciesDef): string[] {
  const ids = new Set(sp.overlays ?? [])
  if (sp.axes) {
    for (const axis of [sp.axes.kind, sp.axes.mask, sp.axes.tail]) {
      for (const list of Object.values(axis)) list.forEach((id) => ids.add(id))
    }
  }
  return [...ids]
}

function validateSpecies(id: string, sp: SpeciesDef, reg: Registry): void {
  const fail = (msg: string): never => {
    throw new Error(`species ${id}: ${msg}`)
  }
  const rig = reg.rigs[sp.rig]
  if (!rig) fail(`rig '${sp.rig}' not found`)
  if (!(sp.scale >= SCALE_MIN && sp.scale <= SCALE_MAX)) {
    fail(`scale ${sp.scale} outside ${SCALE_MIN}-${SCALE_MAX}`)
  }
  if (!(sp.share >= 0)) fail(`share ${sp.share} must be >= 0`)
  if (sp.lanes) {
    const sum = sp.lanes.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > LANE_TOLERANCE) fail(`lanes sum to ${sum}, expected 1`)
  }
  for (const [name, palette] of Object.entries(sp.palettes)) {
    for (const [role, color] of Object.entries(palette)) {
      if (!HEX.test(color)) fail(`palette ${name} role ${role}: invalid hex color '${color}'`)
    }
  }

  const needed = rigRoles(reg.rigs[sp.rig])
  for (const partId of usablePartIds(sp)) {
    const part = reg.parts[partId]
    if (!part) fail(`part '${partId}' not found`)
    if (!part.rigs.includes(sp.rig)) fail(`part '${partId}' is not allowed on rig '${sp.rig}'`)
    for (const r of partRoles(part)) needed.add(r)
  }
  needed.delete(FIXED_ROLE)
  for (const [name, palette] of Object.entries(sp.palettes)) {
    for (const role of needed) {
      if (!(role in palette)) fail(`palette ${name} is missing role '${role}'`)
    }
  }
}

/** Validates the whole registry and returns it unchanged; throws on the first problem. */
export function loadRegistry(input: Registry): Registry {
  for (const rig of Object.values(input.rigs)) validateRig(rig)
  for (const part of Object.values(input.parts)) validatePart(part, input.rigs)
  for (const [id, sp] of Object.entries(input.species)) validateSpecies(id, sp, input)
  return input
}

export function animKey(species: string, variant: string, state: SpriteState): string {
  return `spr:${species}:${variant}:${state}`
}

export function defaultVariant(sp: SpeciesDef): string {
  const palette = Object.keys(sp.palettes)[0]
  const { axes } = sp
  if (!axes) return palette
  return [
    palette,
    Object.keys(axes.kind)[0],
    Object.keys(axes.mask)[0],
    Object.keys(axes.tail)[0],
    Object.keys(axes.body)[0],
  ].join('|')
}

/** Axis cartesian product (palette|kind|mask|tail|body), or the palette list for axis-less species. */
export function allVariants(sp: SpeciesDef): string[] {
  const palettes = Object.keys(sp.palettes)
  const { axes } = sp
  if (!axes) return palettes
  const out: string[] = []
  for (const p of palettes) {
    for (const k of Object.keys(axes.kind)) {
      for (const m of Object.keys(axes.mask)) {
        for (const t of Object.keys(axes.tail)) {
          for (const b of Object.keys(axes.body)) out.push(`${p}|${k}|${m}|${t}|${b}`)
        }
      }
    }
  }
  return out
}

const SCENE_LAYER_IDS = ['back', 'mid', 'front']
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const

/** Validates a forest scene against the tile set; throws `scene: ...` on the first problem. */
export function validateScene(scene: SceneDef, tiles: Record<string, TileDef>): void {
  const fail = (msg: string): never => {
    throw new Error(`scene: ${msg}`)
  }
  const unit = (v: number): boolean => v >= 0 && v <= 1
  if (!unit(scene.ground.y)) fail(`ground.y ${scene.ground.y} outside 0-1`)
  if (scene.layers.length !== SCENE_LAYER_IDS.length) fail('expected exactly 3 layers')
  const needed = new Set<string>()
  scene.layers.forEach((layer, i) => {
    if (layer.id !== SCENE_LAYER_IDS[i]) fail(`layer ${i} must be '${SCENE_LAYER_IDS[i]}'`)
    if (!unit(layer.density)) fail(`layer ${layer.id} density ${layer.density} outside 0-1`)
    if (!unit(layer.y)) fail(`layer ${layer.id} y ${layer.y} outside 0-1`)
    for (const entry of layer.tiles) {
      const tile = tiles[entry.id]
      if (!tile) fail(`layer ${layer.id} tile '${entry.id}' not found`)
      try {
        const map = parsePixelMap(tile.rows, tile.size, TILE_ROLES)
        for (const r of usedRoles(map)) needed.add(r)
      } catch (e) {
        fail(`tile ${entry.id}: ${(e as Error).message}`)
      }
    }
  })
  for (const season of SEASONS) {
    const palette = scene.palettes[season] ?? {}
    for (const role of needed) {
      if (!(role in palette)) fail(`palette ${season} is missing role '${role}'`)
    }
    for (const [role, color] of Object.entries(palette)) {
      if (!HEX.test(color)) fail(`palette ${season} role ${role}: invalid hex color '${color}'`)
    }
  }
}
