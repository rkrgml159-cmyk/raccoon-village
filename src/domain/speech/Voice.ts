export interface Voice {
  syllables: string[]
  marks: string[]
  maxSyllables: number
}

export type Mood = 'greet' | 'chat' | 'soft' | 'upset'

/** Marks every voice must carry so each mood has a candidate. */
export const REQUIRED_MARKS = ['?', '…', '!'] as const
export const MAX_SYLLABLES_LIMIT = 4

const PREFERRED_CHANCE = 0.8

const PREFERRED: Record<Mood, readonly string[]> = {
  greet: ['?', '!'],
  upset: ['…', '!'],
  soft: ['…'],
  chat: [],
}

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}

function chooseMark(v: Voice, mood: Mood, rng: () => number): string {
  const wanted = v.marks.filter((m) => PREFERRED[mood].includes(m))
  if (mood === 'chat' || wanted.length === 0) return pick(v.marks, rng)
  if (mood === 'soft') return wanted[0]
  return rng() < PREFERRED_CHANCE ? pick(wanted, rng) : pick(v.marks, rng)
}

/** Species "language": 1..maxSyllables random syllables plus one mood-shaped mark. Order of rng calls is fixed. */
export function speak(v: Voice, mood: Mood, rng: () => number): string {
  const count = 1 + Math.floor(rng() * v.maxSyllables)
  let text = ''
  for (let i = 0; i < count; i++) text += pick(v.syllables, rng)
  return text + chooseMark(v, mood, rng)
}
