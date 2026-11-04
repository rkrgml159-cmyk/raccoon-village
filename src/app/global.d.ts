import type { DateContext } from '@domain/time/DateContext'
import type { Resident } from '@domain/resident/Resident'
import type { Duet } from '@domain/social/Duets'
import type { Bubble } from '@domain/speech/Bubbles'
import type { VillageState } from '@domain/village/Simulation'

declare global {
  interface Window {
    /** Read-only probe for e2e/screenshot tooling. */
    __rv?: {
      ready: boolean
      ctx: DateContext
      residents: Resident[]
      resident: Resident
      audio: 'off' | 'running' | 'suspended' | 'unavailable'
      duets: Duet[]
      duetLog: VillageState['duetLog']
      bubbles: Bubble[]
      /** Present only with ?debug=1. */
      minds?: VillageState['minds']
      /** Screen-space feet position per resident (same order as `residents`). */
      positions: { x: number; y: number }[]
    }
  }
}

export {}
