import { policy, type Mode } from '@domain/wallpaper/PowerPolicy'

export interface GameLike {
  loop: { sleep(): void; wake(): void }
  events: { emit(ev: string): void }
}
export interface WindLike {
  state: string
  fadeTo(g: number, ms?: number): void
  suspend(): void
}
export interface PowerEnv {
  doc: { hidden: boolean; addEventListener(t: 'visibilitychange', f: () => void): void }
  reducedMotion(): boolean
}

/** Phaser's Core RESUME event name. */
const RESUME = 'resume'

/**
 * Apply PowerPolicy on visibility changes: stop the render loop while hidden (Phaser only pauses
 * its clock), and quiet the wind (only once it has been started). Returns apply() so callers can
 * run it once, e.g. when the page was opened in a background tab.
 */
export function bindPowerPolicy(
  game: GameLike,
  mode: Mode,
  wind: WindLike,
  windGain: number,
  env: PowerEnv,
): () => void {
  let sleeping = false
  const apply = (): void => {
    const { audioAllowed, targetFps } = policy({
      mode,
      hidden: env.doc.hidden,
      reducedMotion: env.reducedMotion(),
    })
    if (targetFps === 0 && !sleeping) {
      sleeping = true
      game.loop.sleep()
    } else if (targetFps > 0 && sleeping) {
      sleeping = false
      game.loop.wake()
      // The scene recomputes DateContext and snaps the sky on RESUME.
      game.events.emit(RESUME)
    }
    if (wind.state === 'off' || wind.state === 'unavailable') return
    if (audioAllowed) wind.fadeTo(windGain)
    else wind.suspend()
  }
  env.doc.addEventListener('visibilitychange', apply)
  return apply
}
