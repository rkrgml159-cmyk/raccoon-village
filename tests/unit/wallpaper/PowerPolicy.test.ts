import { describe, it, expect } from 'vitest'
import { policy } from '@domain/wallpaper/PowerPolicy'

describe('policy', () => {
  it.each([
    [
      { mode: 'play', hidden: false, reducedMotion: false },
      { targetFps: 60, particleCap: 200, audioAllowed: true },
    ],
    [
      { mode: 'wallpaper', hidden: false, reducedMotion: false },
      { targetFps: 30, particleCap: 60, audioAllowed: true },
    ],
    [
      { mode: 'wallpaper', hidden: true, reducedMotion: false },
      { targetFps: 0, particleCap: 60, audioAllowed: false },
    ],
    [
      { mode: 'play', hidden: false, reducedMotion: true },
      { targetFps: 60, particleCap: 0, audioAllowed: true },
    ],
  ])('policy %o', (i, o) => expect(policy(i as Parameters<typeof policy>[0])).toEqual(o))
})
