import { describe, expect, it } from 'vitest'
import {
  SITUATIONS,
  pickThought,
  situationFor,
  validateThoughts,
  violations,
  type ThoughtCtx,
  type ThoughtsData,
} from '@domain/speech/Thoughts'

const calmNeeds = { hunger: 0.3, sleepy: 0.3, bored: 0.3, lonely: 0.3 }
const base: ThoughtCtx = {
  needs: calmNeeds,
  phase: 'day',
  season: 'spring',
  traits: ['calm', 'tidy'],
  species: 'raccoon',
  idleMs: 0,
}

function data(entries: ThoughtsData['entries']): ThoughtsData {
  return { situations: [...SITUATIONS], entries }
}

describe('situationFor', () => {
  it('has 30 unique situations', () => {
    expect(SITUATIONS).toHaveLength(30)
    expect(new Set(SITUATIONS).size).toBe(30)
  })

  it('base order: phase, season, idleLong', () => {
    expect(situationFor(base)).toEqual(['day', 'spring', 'idleLong'])
  })

  it('duet first, then needs, band, phase, season, idleLong', () => {
    const c: ThoughtCtx = {
      ...base,
      lastDuet: 'sitTogether',
      needs: { hunger: 0.9, sleepy: 0.1, bored: 0.8, lonely: 0.85 },
      band: 'friend',
      phase: 'night',
      season: 'winter',
    }
    expect(situationFor(c)).toEqual([
      'afterSit',
      'hungry',
      'bored',
      'lonely',
      'friend',
      'night',
      'winter',
      'idleLong',
    ])
  })

  it('maps every duet and ignores neutral band', () => {
    const map = {
      greet: 'afterGreet',
      chat: 'afterChat',
      sitTogether: 'afterSit',
      chase: 'afterChase',
      share: 'afterShare',
      groom: 'afterGroom',
      quarrel: 'afterQuarrel',
      makeUp: 'afterMakeUp',
    } as const
    for (const [d, s] of Object.entries(map)) {
      expect(situationFor({ ...base, lastDuet: d as keyof typeof map })[0]).toBe(s)
    }
    expect(situationFor({ ...base, band: 'neutral' })).not.toContain('neutral')
    expect(situationFor({ ...base, band: 'bestie' })[0]).toBe('bestie')
    expect(situationFor({ ...base, band: 'awkward' })[0]).toBe('awkward')
  })

  it('sleepy need maps to sleepy', () => {
    expect(situationFor({ ...base, needs: { ...calmNeeds, sleepy: 0.8 } })[0]).toBe('sleepy')
  })
})

describe('pickThought', () => {
  const rng = () => 0
  it('trait match beats any', () => {
    const d = data([
      { situation: 'day', trait: 'any', species: 'any', lines: ['a'] },
      { situation: 'day', trait: 'calm', species: 'any', lines: ['b'] },
    ])
    expect(pickThought(base, d, [], rng)).toBe('b')
  })

  it('falls back to any when trait lines are all recent', () => {
    const d = data([
      { situation: 'day', trait: 'any', species: 'any', lines: ['a'] },
      { situation: 'day', trait: 'calm', species: 'any', lines: ['b'] },
    ])
    expect(pickThought(base, d, ['b'], rng)).toBe('a')
  })

  it('species line only for that species', () => {
    const d = data([{ situation: 'day', trait: 'any', species: 'otter', lines: ['o'] }])
    expect(pickThought(base, d, [], rng)).toBeNull()
    expect(pickThought({ ...base, species: 'otter' }, d, [], rng)).toBe('o')
  })

  it('skips recent and moves to next situation', () => {
    const d = data([
      { situation: 'day', trait: 'any', species: 'any', lines: ['a'] },
      { situation: 'spring', trait: 'any', species: 'any', lines: ['s'] },
    ])
    expect(pickThought(base, d, ['a'], rng)).toBe('s')
  })

  it('falls back to idleLong then null', () => {
    const d = data([{ situation: 'idleLong', trait: 'any', species: 'any', lines: ['i'] }])
    expect(pickThought(base, d, [], rng)).toBe('i')
    expect(pickThought(base, d, ['i'], rng)).toBeNull()
  })

  it('uses rng to draw', () => {
    const d = data([{ situation: 'day', trait: 'any', species: 'any', lines: ['a', 'b', 'c'] }])
    expect(pickThought(base, d, [], () => 0.99)).toBe('c')
  })
})

describe('violations / validateThoughts', () => {
  const ok = (): unknown => ({
    situations: [...SITUATIONS],
    entries: [{ situation: 'day', trait: 'any', species: 'any', lines: ['좋은 하루.'] }],
  })
  const withLines = (lines: unknown[], extra: object = {}): unknown => ({
    situations: [...SITUATIONS],
    entries: [{ situation: 'day', trait: 'any', species: 'any', lines, ...extra }],
  })

  it('violations finds a forbidden word', () => {
    expect(violations(['전쟁이 있었다', '평화'], ['전쟁'])).toEqual(['전쟁이 있었다'])
  })

  it('accepts valid data', () => {
    expect(validateThoughts(ok(), ['전쟁']).entries).toHaveLength(1)
  })

  it('rejects bad shapes', () => {
    expect(() => validateThoughts(null, [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts({ situations: [], entries: [] }, [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts({ situations: [...SITUATIONS] }, [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts({ situations: [...SITUATIONS], entries: [1] }, [])).toThrow(
      /^thoughts:/,
    )
    expect(() => validateThoughts(withLines([], {}), [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts(withLines(['a'], { species: 3 }), [])).toThrow(/^thoughts:/)
  })

  it('rejects unknown situation and trait', () => {
    expect(() => validateThoughts(withLines(['a'], { situation: 'zzz' }), [])).toThrow(/situation/)
    expect(() => validateThoughts(withLines(['a'], { trait: 'zzz' }), [])).toThrow(/trait/)
  })

  it('rejects bad lines', () => {
    expect(() => validateThoughts(withLines(['']), [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts(withLines([5]), [])).toThrow(/^thoughts:/)
    expect(() => validateThoughts(withLines(['가'.repeat(23)]), [])).toThrow(/22/)
    expect(() => validateThoughts(withLines(['가. 나. 다']), [])).toThrow(/\./)
    expect(() => validateThoughts(withLines(['하나 1']), [])).toThrow(/digit/)
    expect(() => validateThoughts(withLines(['웃음😀']), [])).toThrow(/emoji/)
    expect(() => validateThoughts(withLines(['웃음☀']), [])).toThrow(/emoji/)
    expect(() => validateThoughts(withLines(['전쟁터']), ['전쟁'])).toThrow(/forbidden/)
    expect(() => validateThoughts(withLines(['같은', '같은']), [])).toThrow(/duplicate/)
  })

  it('counts code points, not UTF-16 units', () => {
    expect(() => validateThoughts(withLines(['가'.repeat(22)]), [])).not.toThrow()
  })
})
