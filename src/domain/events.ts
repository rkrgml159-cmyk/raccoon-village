import type { Phase, Season } from './time/DateContext'
import type { ResidentState } from './resident/Resident'

export type GameEvents = {
  phaseChanged: { from: Phase; to: Phase }
  seasonChanged: { from: Season; to: Season }
  residentStateChanged: { id: string; state: ResidentState }
}

type Listener<P> = (p: P) => void

export class Emitter<M extends Record<string, unknown>> {
  private listeners: { [K in keyof M]?: Listener<M[K]>[] } = {}

  on<K extends keyof M>(k: K, f: Listener<M[K]>): () => void {
    this.listeners[k] = [...(this.listeners[k] ?? []), f]
    return () => this.off(k, f)
  }

  off<K extends keyof M>(k: K, f: Listener<M[K]>): void {
    this.listeners[k] = (this.listeners[k] ?? []).filter((l) => l !== f)
  }

  emit<K extends keyof M>(k: K, p: M[K]): void {
    for (const f of this.listeners[k] ?? []) f(p)
  }
}
