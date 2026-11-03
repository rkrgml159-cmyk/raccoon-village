import { describe, expect, it, vi } from 'vitest'
import { bindPowerPolicy } from '@app/powerBinding'

function setup(opts: { hidden?: boolean; wind?: string; mode?: 'play' | 'wallpaper' } = {}) {
  const listeners: (() => void)[] = []
  const doc = {
    hidden: opts.hidden ?? false,
    addEventListener: (_t: 'visibilitychange', f: () => void) => listeners.push(f),
  }
  const game = {
    loop: { sleep: vi.fn(), wake: vi.fn(), running: undefined as boolean | undefined },
    events: { emit: vi.fn() },
  }
  const wind = { state: opts.wind ?? 'running', fadeTo: vi.fn(), suspend: vi.fn() }
  const apply = bindPowerPolicy(game, opts.mode ?? 'wallpaper', wind, 0.12, {
    doc,
    reducedMotion: () => false,
  })
  const fire = (hidden: boolean): void => {
    doc.hidden = hidden
    listeners.forEach((f) => f())
  }
  return { game, wind, apply, fire }
}

describe('bindPowerPolicy', () => {
  it('sleeps once when hidden, even on repeated events', () => {
    const { game, fire } = setup()
    fire(true)
    fire(true)
    expect(game.loop.sleep).toHaveBeenCalledTimes(1)
  })
  it('wakes once and emits resume when visible again', () => {
    const { game, fire } = setup()
    fire(true)
    fire(false)
    fire(false)
    expect(game.loop.wake).toHaveBeenCalledTimes(1)
    expect(game.events.emit).toHaveBeenCalledTimes(1)
    expect(game.events.emit).toHaveBeenCalledWith('resume')
  })
  it('does not wake when it never slept', () => {
    const { game, fire } = setup()
    fire(false)
    expect(game.loop.wake).not.toHaveBeenCalled()
  })
  it.each(['off', 'unavailable'])('leaves wind alone when %s', (state) => {
    const { wind, fire } = setup({ wind: state })
    fire(true)
    fire(false)
    expect(wind.fadeTo).not.toHaveBeenCalled()
    expect(wind.suspend).not.toHaveBeenCalled()
  })
  it('suspends wind on hidden and fades back to gain on visible', () => {
    const { wind, fire } = setup()
    fire(true)
    expect(wind.suspend).toHaveBeenCalledTimes(1)
    fire(false)
    expect(wind.fadeTo).toHaveBeenCalledWith(0.12)
  })
  it('initial apply() while hidden sleeps', () => {
    const { game, apply } = setup({ hidden: true })
    apply()
    expect(game.loop.sleep).toHaveBeenCalledTimes(1)
  })
  it('initial apply() while visible does nothing to the loop', () => {
    const { game, apply } = setup()
    apply()
    expect(game.loop.sleep).not.toHaveBeenCalled()
  })
  it('a no-op sleep before the loop runs is retried on the next hidden event', () => {
    const { game, apply, fire } = setup({ hidden: true })
    // Phaser's TimeStep.sleep() does nothing while running is false.
    game.loop.running = false
    apply()
    expect(game.loop.sleep).toHaveBeenCalledTimes(1)
    game.loop.running = true // loop started afterwards
    fire(true)
    expect(game.loop.sleep).toHaveBeenCalledTimes(2)
    // and a real sleep is not repeated
    game.loop.running = false
    fire(true)
    expect(game.loop.sleep).toHaveBeenCalledTimes(2)
  })
  it('a real sleep then wake round-trips with running state', () => {
    const { game, fire } = setup()
    game.loop.running = true
    game.loop.sleep.mockImplementation(() => {
      game.loop.running = false
    })
    fire(true)
    fire(false)
    expect(game.loop.wake).toHaveBeenCalledTimes(1)
  })
})
