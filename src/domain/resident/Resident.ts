export type ResidentState = 'idle' | 'walk' | 'sit' | 'sleep'

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
