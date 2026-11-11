import { describe, it, expect } from 'vitest'
import { NEED_ICON_KEY, type NeedKey } from '@domain/mind/Needs'
import { UI } from '@domain/sprites/catalog'

describe('need icons', () => {
  it('every need resolves to a UI icon', () => {
    for (const k of Object.keys(NEED_ICON_KEY) as NeedKey[])
      expect(UI.icons[NEED_ICON_KEY[k]], k).toBeTruthy()
  })
})
