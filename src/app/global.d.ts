import type { DateContext } from '@domain/time/DateContext'
import type { Resident } from '@domain/resident/Resident'

declare global {
  interface Window {
    /** Read-only probe for e2e/screenshot tooling. */
    __rv?: {
      ready: boolean
      ctx: DateContext
      residents: Resident[]
      resident: Resident
      audio: 'off' | 'running' | 'suspended' | 'unavailable'
    }
  }
}

export {}
