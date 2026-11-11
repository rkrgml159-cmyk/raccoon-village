import { describe, expect, it } from 'vitest'
import { BUBBLE_TTL, BubbleQueue, FADE_MS, MAX_BUBBLES } from '@domain/speech/Bubbles'

const mk = (residentId: string, kind: 'thought' | 'speech' | 'icon' = 'speech') => ({
  residentId,
  kind,
  text: 'x',
  ttlMs: BUBBLE_TTL[kind],
})

describe('BubbleQueue', () => {
  it('max 3', () => {
    const q = new BubbleQueue()
    expect(MAX_BUBBLES).toBe(3)
    expect(q.push(mk('a'), 0)).toBe(true)
    expect(q.push(mk('b'), 0)).toBe(true)
    expect(q.push(mk('c'), 0)).toBe(true)
    expect(q.push(mk('d'), 0)).toBe(false)
    expect(q.tick(1)).toHaveLength(3)
  })

  it('higher priority evicts the lowest when full', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'icon'), 0)
    q.push(mk('b', 'speech'), 10)
    q.push(mk('c', 'speech'), 20)
    expect(q.push(mk('d', 'thought'), 30)).toBe(true)
    const ids = q.tick(40).map((b) => b.residentId)
    expect(ids).toEqual(['b', 'c', 'd'])
  })

  it('one per resident replaced by higher priority', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'icon'), 0)
    expect(q.push(mk('a', 'thought'), 5)).toBe(true)
    const alive = q.tick(6)
    expect(alive).toHaveLength(1)
    expect(alive[0].kind).toBe('thought')
  })

  it('a new thought fades out any other thought (one thought on screen)', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'thought'), 0)
    expect(q.push(mk('b', 'thought'), 1000)).toBe(true)
    const fading = q.tick(1100).find((b) => b.residentId === 'a')!
    expect(q.alphaOf(fading, 1100)).toBeLessThan(1)
    expect(q.tick(1000 + FADE_MS).map((b) => b.residentId)).toEqual(['b'])
  })

  it('lower priority refused for same resident', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'thought'), 0)
    expect(q.push(mk('a', 'icon'), 5)).toBe(false)
    expect(q.tick(6)[0].kind).toBe('thought')
  })

  it('assigns unique ids and bornMs', () => {
    const q = new BubbleQueue()
    q.push(mk('a'), 100)
    q.push(mk('b'), 200)
    const [x, y] = q.tick(300)
    expect(x.id).not.toBe(y.id)
    expect([x.bornMs, y.bornMs]).toEqual([100, 200])
  })

  it('expires after ttl', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'icon'), 0)
    expect(q.tick(BUBBLE_TTL.icon - 1)).toHaveLength(1)
    expect(q.tick(BUBBLE_TTL.icon)).toHaveLength(0)
  })

  it('expired bubbles do not block a push', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'thought'), 0)
    expect(q.push(mk('a', 'icon'), 6000)).toBe(true)
  })

  it('alpha ramps 250 ms', () => {
    const q = new BubbleQueue()
    q.push(mk('a', 'speech'), 1000)
    const b = q.tick(1000)[0]
    expect(FADE_MS).toBe(250)
    expect(q.alphaOf(b, 1000)).toBe(0)
    expect(q.alphaOf(b, 1125)).toBeCloseTo(0.5)
    expect(q.alphaOf(b, 1250)).toBe(1)
    expect(q.alphaOf(b, 2000)).toBe(1)
    expect(q.alphaOf(b, 1000 + 2500 - 125)).toBeCloseTo(0.5)
    expect(q.alphaOf(b, 1000 + 2500)).toBe(0)
    expect(q.alphaOf(b, 9999)).toBe(0)
  })
})
