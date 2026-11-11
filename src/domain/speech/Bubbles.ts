export type BubbleKind = 'thought' | 'speech' | 'icon'

export interface Bubble {
  id: string
  residentId: string
  kind: BubbleKind
  text: string
  bornMs: number
  ttlMs: number
}

export const BUBBLE_TTL: Record<BubbleKind, number> = { thought: 5000, speech: 2500, icon: 2000 }
export const MAX_BUBBLES = 3
export const FADE_MS = 250

const PRIORITY: Record<BubbleKind, number> = { thought: 3, speech: 2, icon: 1 }

export class BubbleQueue {
  private alive: Bubble[] = []
  private seq = 0

  /** Returns false when the new bubble is refused. */
  push(b: Omit<Bubble, 'id' | 'bornMs'>, nowMs: number): boolean {
    this.tick(nowMs)
    const p = PRIORITY[b.kind]
    const same = this.alive.find((x) => x.residentId === b.residentId)
    if (same) {
      if (PRIORITY[same.kind] > p) return false
      this.alive = this.alive.filter((x) => x !== same)
    } else if (this.alive.length >= MAX_BUBBLES) {
      // evict the lowest-priority (oldest on ties) bubble, only if the new one outranks it
      let victim = this.alive[0]
      for (const x of this.alive) if (PRIORITY[x.kind] < PRIORITY[victim.kind]) victim = x
      if (PRIORITY[victim.kind] >= p) return false
      this.alive = this.alive.filter((x) => x !== victim)
    }
    if (b.kind === 'thought') {
      // One thought on screen: any other thought fades out now.
      this.alive = this.alive.map((x) =>
        x.kind === 'thought' ? { ...x, ttlMs: Math.min(x.ttlMs, nowMs - x.bornMs + FADE_MS) } : x,
      )
    }
    this.alive.push({ ...b, id: `b${this.seq++}`, bornMs: nowMs })
    return true
  }

  /** Drops expired bubbles; returns the alive ones sorted by birth. */
  tick(nowMs: number): Bubble[] {
    this.alive = this.alive.filter((x) => nowMs - x.bornMs < x.ttlMs)
    return [...this.alive].sort((a, b) => a.bornMs - b.bornMs)
  }

  alphaOf(b: Bubble, nowMs: number): number {
    const age = nowMs - b.bornMs
    const a = Math.min(age / FADE_MS, (b.ttlMs - age) / FADE_MS, 1)
    return Math.max(0, a)
  }
}
