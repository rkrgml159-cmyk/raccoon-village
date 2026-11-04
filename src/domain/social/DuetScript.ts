import type { SpriteState } from '../sprites/types'
import type { DuetType } from './types'

export type Role = 'a' | 'b'

export interface Cue {
  anim: SpriteState
  flip: 'toward' | 'away' | 'same'
  /** Fraction of the view width, added to the resident's own x. */
  offsetX: number
}

const SIT_OFFSET = 0.015

const toward = (anim: SpriteState): Cue => ({ anim, flip: 'toward', offsetX: 0 })
const interact = (role: Role, swap: boolean): SpriteState =>
  (role === 'a') !== swap ? 'interact_a' : 'interact_b'

/** What a duet participant looks like at a given step. Pure lookup, no state. */
export function scriptFor(type: DuetType, step: number, role: Role): Cue {
  switch (type) {
    case 'greet':
      return toward(interact(role, false))
    case 'chat':
    case 'groom':
      return toward(interact(role, step % 2 === 1))
    case 'sitTogether':
      return { anim: 'sit', flip: 'same', offsetX: role === 'a' ? -SIT_OFFSET : SIT_OFFSET }
    case 'chase':
      return toward('walk')
    case 'share':
      if (step === 0) return toward(role === 'a' ? 'interact_a' : 'idle')
      return toward(role === 'b' ? 'happy' : 'interact_a')
    case 'quarrel':
      return { anim: 'sulk', flip: 'away', offsetX: 0 }
    case 'makeUp':
      return step === 0 ? toward(interact(role, false)) : toward('happy')
  }
}

/** Whether a resident faces left for a cue, given own and partner x. Equal x keeps the current facing. */
export function facesLeft(
  flip: Cue['flip'],
  selfX: number,
  otherX: number,
  currentlyLeft: boolean,
): boolean {
  if (flip === 'same') return false
  if (otherX === selfX) return currentlyLeft
  const partnerLeft = otherX < selfX
  return flip === 'toward' ? partnerLeft : !partnerLeft
}
