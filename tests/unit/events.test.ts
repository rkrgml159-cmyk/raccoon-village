import { describe, it, expect } from 'vitest'
import { Emitter } from '@domain/events'

describe('Emitter', () => {
  it('on/emit/off', () => {
    const e = new Emitter<{ a: number }>()
    const got: number[] = []
    const off = e.on('a', (v) => got.push(v))
    e.emit('a', 1)
    off()
    e.emit('a', 2)
    expect(got).toEqual([1])
  })

  it('off removes a listener by reference', () => {
    const e = new Emitter<{ a: number }>()
    const got: number[] = []
    const f = (v: number) => got.push(v)
    e.on('a', f)
    e.off('a', f)
    e.emit('a', 1)
    expect(got).toEqual([])
  })

  it('emit with no listeners is a no-op', () => {
    const e = new Emitter<{ a: number }>()
    expect(() => e.emit('a', 1)).not.toThrow()
    e.off('a', () => {})
  })

  it('listeners removed or added during emit do not break iteration', () => {
    const e = new Emitter<{ a: number }>()
    const got: string[] = []
    const off1 = e.on('a', () => {
      got.push('1')
      off1()
      e.on('a', () => got.push('late'))
    })
    e.on('a', () => got.push('2'))
    e.emit('a', 0)
    expect(got).toEqual(['1', '2'])
    e.emit('a', 0)
    expect(got).toEqual(['1', '2', '2', 'late'])
  })
})
