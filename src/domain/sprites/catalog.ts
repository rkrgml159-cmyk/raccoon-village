import speciesJson from '../../../data/sprites/species.json'
import forestJson from '../../../data/scenes/forest.json'
import traitsJson from '../../../data/behavior/traits.json'
import thoughtsJson from '../../../data/dialogue/thoughts.json'
import forbiddenJson from '../../../data/dialogue/forbidden.json'
import uiJson from '../../../data/ui.json'
import { validateThoughts } from '../speech/Thoughts'
import { validateTraitTable, type TraitTable } from '../mind/Traits'
import type { PartDef, RigDef, SceneDef, SpeciesDef, TileDef } from './types'

/** Keys are file basenames without `.json`. */
function byBasename<T>(modules: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [path, mod] of Object.entries(modules)) {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '')
    out[name] = mod
  }
  return out
}

export const RIGS: Record<string, RigDef> = byBasename(
  import.meta.glob<RigDef>('../../../data/sprites/rigs/*.json', { eager: true, import: 'default' }),
)

export const PARTS: Record<string, PartDef> = byBasename(
  import.meta.glob<PartDef>('../../../data/sprites/parts/*.json', {
    eager: true,
    import: 'default',
  }),
)

export const SPECIES = speciesJson as unknown as Record<string, SpeciesDef>

export const TILES: Record<string, TileDef> = byBasename(
  import.meta.glob<TileDef>('../../../data/sprites/tiles/*.json', {
    eager: true,
    import: 'default',
  }),
)

export const FOREST = forestJson as unknown as SceneDef

export const BEHAVIOR_TRAITS: TraitTable = validateTraitTable(traitsJson)

export const FORBIDDEN: string[] = forbiddenJson as string[]

export const THOUGHTS = validateThoughts(thoughtsJson, FORBIDDEN)

export const UI = uiJson as {
  soundOn: string
  icons: Record<string, string>
  relationMarks: Record<string, string>
}
