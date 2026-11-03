export type ResidentState = 'idle' | 'walk' | 'sit'

export interface Resident {
  id: string
  species: 'raccoon'
  lane: 0 | 1 | 2
  x: number
  facing: 'left' | 'right'
  state: ResidentState
  stateT: number
  targetX?: number
  /** Most recent states, at most 3. */
  history: ResidentState[]
}

export function createResident(id: string, x = 0.5): Resident {
  return {
    id,
    species: 'raccoon',
    lane: 1,
    x,
    facing: 'right',
    state: 'idle',
    stateT: 6000,
    history: [],
  }
}
