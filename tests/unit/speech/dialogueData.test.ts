import { describe, expect, it } from 'vitest'
import { FORBIDDEN, THOUGHTS, UI } from '@domain/sprites/catalog'
import { TRAITS } from '@domain/mind/Traits'
import { SITUATIONS, validateThoughts, violations } from '@domain/speech/Thoughts'

describe('dialogue data', () => {
  it('real thoughts.json validates', () => {
    expect(() => validateThoughts(THOUGHTS, FORBIDDEN)).not.toThrow()
    expect(
      violations(
        THOUGHTS.entries.flatMap((e) => e.lines),
        FORBIDDEN,
      ),
    ).toEqual([])
  })

  it('every situation has >= 6 lines', () => {
    for (const s of SITUATIONS) {
      const n = THOUGHTS.entries
        .filter((e) => e.situation === s)
        .reduce((a, e) => a + e.lines.length, 0)
      expect(n, s).toBeGreaterThanOrEqual(6)
    }
  })

  it('every trait has >= 20 lines', () => {
    for (const t of TRAITS) {
      const n = THOUGHTS.entries
        .filter((e) => e.trait === t)
        .reduce((a, e) => a + e.lines.length, 0)
      expect(n, t).toBeGreaterThanOrEqual(20)
    }
  })

  it('no duplicate lines', () => {
    const all = THOUGHTS.entries.flatMap((e) => e.lines)
    expect(new Set(all).size).toBe(all.length)
  })

  it('forbidden.json has >= 15 words', () => {
    expect(FORBIDDEN.length).toBeGreaterThanOrEqual(15)
    for (const w of FORBIDDEN) expect(w.length).toBeGreaterThan(0)
  })

  it('ui icons and relation marks exist', () => {
    for (const k of [
      'leaf',
      'sleepy',
      'bored',
      'lonely',
      'heart',
      'anger',
      'sparkle',
      'question',
    ]) {
      expect(UI.icons[k], k).toBeTruthy()
    }
    for (const k of ['awkward', 'neutral', 'friend', 'bestie']) {
      expect(typeof UI.relationMarks[k]).toBe('string')
    }
    expect(UI.soundOn).toBeTruthy()
  })
})
