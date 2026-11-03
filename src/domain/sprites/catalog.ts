import speciesJson from '../../../data/sprites/species.json'
import type { PartDef, RigDef, SpeciesDef } from './types'

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
