import { describe, expect, it } from 'vitest'
import { FORBIDDEN, THOUGHTS, UI } from '@domain/sprites/catalog'
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

  it('every situation has >= 2 lines', () => {
    for (const s of SITUATIONS) {
      const n = THOUGHTS.entries
        .filter((e) => e.situation === s)
        .reduce((a, e) => a + e.lines.length, 0)
      expect(n, s).toBeGreaterThanOrEqual(2)
    }
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
