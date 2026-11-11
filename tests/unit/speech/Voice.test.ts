import { describe, expect, it } from 'vitest'
import { speak } from '../../../src/domain/speech/Voice'
import type { Mood, Voice } from '../../../src/domain/speech/Voice'

const voice: Voice = { syllables: ['aa', 'bb', 'cc'], marks: ['?', '…', '!', '.'], maxSyllables: 3 }

function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function split(text: string): { body: string; mark: string } {
  return { body: text.slice(0, -1), mark: text.slice(-1) }
}

describe('speak', () => {
  it('uses 1..max syllables and ends with a mark', () => {
    const rng = lcg(1)
    const moods: Mood[] = ['greet', 'chat', 'soft', 'upset']
    for (let i = 0; i < 500; i++) {
      const { body, mark } = split(speak(voice, moods[i % 4], rng))
      expect(voice.marks).toContain(mark)
      const n = body.length / 2
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(voice.maxSyllables)
      for (let k = 0; k < n; k++) expect(voice.syllables).toContain(body.slice(k * 2, k * 2 + 2))
    }
  })

  it('greet prefers ? or !', () => {
    const rng = lcg(7)
    let hits = 0
    for (let i = 0; i < 500; i++) if ('?!'.includes(split(speak(voice, 'greet', rng)).mark)) hits++
    expect(hits / 500).toBeGreaterThanOrEqual(0.8)
  })

  it('upset prefers … or !', () => {
    const rng = lcg(9)
    let hits = 0
    for (let i = 0; i < 500; i++) if ('…!'.includes(split(speak(voice, 'upset', rng)).mark)) hits++
    expect(hits / 500).toBeGreaterThanOrEqual(0.8)
  })

  it('soft ends with …', () => {
    const rng = lcg(3)
    for (let i = 0; i < 100; i++) expect(split(speak(voice, 'soft', rng)).mark).toBe('…')
  })

  it('soft and preferred moods fall back to all marks when none match', () => {
    const odd: Voice = { syllables: ['aa', 'bb'], marks: ['.'], maxSyllables: 1 }
    for (const m of ['greet', 'upset', 'soft', 'chat'] as Mood[]) {
      expect(speak(odd, m, lcg(2)).endsWith('.')).toBe(true)
    }
  })

  it('is deterministic for the same rng sequence', () => {
    const run = (seed: number): string[] => {
      const rng = lcg(seed)
      return Array.from({ length: 50 }, () => speak(voice, 'chat', rng))
    }
    expect(run(42)).toEqual(run(42))
  })
})
