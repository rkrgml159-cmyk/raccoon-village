import type { Weights } from '../sprites/types'
import type { Needs } from './Needs'
import { traitMultiplier, type Trait, type TraitTable } from './Traits'

export type FullWeights = Required<Weights>

export const DEFAULT_EXTRA = { forage: 0.06, approach: 0.08 }

/** Species base weights, scaled by needs first and then by trait multipliers. */
export function composeWeights(
  base: Weights,
  needs: Needs,
  traits: readonly Trait[],
  table: TraitTable,
): FullWeights {
  const m = (key: string): number => traitMultiplier(traits, key, table)
  return {
    idle: base.idle * m('idle'),
    walk: base.walk * (1 + needs.bored) * m('walk'),
    sit: base.sit * m('sit'),
    sleep: base.sleep * (1 + 2 * needs.sleepy),
    forage: (base.forage ?? DEFAULT_EXTRA.forage) * (1 + 2 * needs.hunger) * m('forage'),
    approach:
      (base.approach ?? DEFAULT_EXTRA.approach) *
      (1 + 2 * needs.lonely + needs.bored) *
      m('approach'),
  }
}
