import type { SpriteState } from '../sprites/types'

export type ResidentState = 'idle' | 'walk' | 'sit' | 'sleep' | 'forage' | 'approach' | 'duet'

export interface Resident {
  id: string
  species: string
  variant: string
  scale: number
  lane: 0 | 1 | 2
  x: number
  facing: 'left' | 'right'
  state: ResidentState
  stateT: number
  targetX?: number
  targetId?: string
  duetId?: string
  /** Most recent states, at most 3. */
  history: ResidentState[]
}

/** The domain does not know the registry: callers pass the default variant in `init`. */
export function createResident(
  id: string,
  x = 0.5,
  init: Partial<Pick<Resident, 'species' | 'variant' | 'scale' | 'lane'>> = {},
): Resident {
  return {
    id,
    species: init.species ?? 'raccoon',
    variant: init.variant ?? '',
    scale: init.scale ?? 1,
    lane: init.lane ?? 1,
    x,
    facing: 'right',
    state: 'idle',
    stateT: 6000,
    history: [],
  }
}

/** Sprite pose for a state; the new M2b states reuse existing poses until they get their own. */
export function spriteStateOf(state: ResidentState): SpriteState {
  if (state === 'approach') return 'walk'
  if (state === 'forage' || state === 'duet') return 'idle'
  return state
}
