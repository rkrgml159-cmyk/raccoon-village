import Phaser from 'phaser'
import { mulberry32 } from '@domain/rng'
import { FastClock, FixedClock, RealClock, type Clock } from '@domain/time/Clock'
import type { Mode } from '@domain/wallpaper/PowerPolicy'
import { VillageScene } from '@render/scenes/VillageScene'
import { WindSynth } from '@render/audio/WindSynth'
import { bindPowerPolicy } from './powerBinding'
import { parseQuery, type BootOptions } from './query'

export interface BootDeps {
  clock: Clock
  rng: () => number
  opts: BootOptions
  mode: Mode
  blendMs: number
  wind: WindSynth
}

const WIND_GAIN = 0.12

export function makeDeps(mode: Mode, search = location.search): BootDeps {
  const parsed = parseQuery(search)
  const seed = parsed.seed ?? Math.floor(Math.random() * 1e9)
  const opts: BootOptions = { ...parsed, seed }
  let clock: Clock = parsed.at ? new FixedClock(parsed.at) : new RealClock()
  if (opts.speed > 1) {
    const start = parsed.at ? new FixedClock(parsed.at).now() : new Date()
    clock = new FastClock(start, opts.speed)
  }
  return {
    clock,
    rng: mulberry32(seed),
    opts,
    mode,
    blendMs: 60000 / opts.speed,
    wind: new WindSynth(),
  }
}

export function createGame(deps: BootDeps, parent = 'game'): Phaser.Game {
  const wallpaper = deps.mode === 'wallpaper'
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    pixelArt: true,
    autoFocus: false,
    audio: { noAudio: true },
    fps: wallpaper ? { target: 30, forceSetTimeOut: true } : { target: 60 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [new VillageScene(deps)],
  })
}

/** Wire visibility → PowerPolicy, and apply it once after boot (background-tab start). */
export function bindPower(game: Phaser.Game, deps: BootDeps): void {
  const apply = bindPowerPolicy(game, deps.mode, deps.wind, WIND_GAIN, {
    doc: document,
    reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
  if (game.isBooted) apply()
  else game.events.once(Phaser.Core.Events.READY, apply)
}
