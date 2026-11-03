import { bindPowerPolicy, createGame, makeDeps } from './boot'

const deps = makeDeps('play')
const game = createGame(deps)
bindPowerPolicy(game, deps)

// Audio only after a user gesture. Touch `pointerdown` does not unlock audio, so listen for
// `pointerup`/`click` and keep listening until the synth is running (or unavailable).
const unlock = async (): Promise<void> => {
  await deps.wind.start()
  if (deps.wind.state === 'running' || deps.wind.state === 'unavailable') {
    document.removeEventListener('pointerup', unlock)
    document.removeEventListener('click', unlock)
  }
}
document.addEventListener('pointerup', unlock)
document.addEventListener('click', unlock)
