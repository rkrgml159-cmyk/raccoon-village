import { policy, type Mode } from '@domain/wallpaper/PowerPolicy'

export interface GameLike {
  /** `running` mirrors Phaser.Core.TimeStep#running: sleep() is a no-op before the loop starts. */
  loop: { sleep(): void; wake(): void; running?: boolean }
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
 * run it once the loop is running, e.g. when the page was opened in a background tab.
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
      // sleep() is a no-op while the loop has not started: stay "awake" so the next hidden
      // event retries instead of being swallowed by the sleeping flag.
      const canSleep = game.loop.running !== false
      game.loop.sleep()
      sleeping = canSleep
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
