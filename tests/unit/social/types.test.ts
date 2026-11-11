import { describe, expect, it } from 'vitest'
import { DUET_TYPES } from '@domain/social/types'

describe('DUET_TYPES', () => {
  it('lists all 8 duet types in order', () => {
    expect(DUET_TYPES).toEqual([
      'greet',
      'chat',
      'sitTogether',
      'chase',
      'share',
      'groom',
      'quarrel',
      'makeUp',
    ])
  })
})
