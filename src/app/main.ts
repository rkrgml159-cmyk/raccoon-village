import { bindAudioPolicy, createGame, makeDeps } from './boot'

const deps = makeDeps('play')
createGame(deps)
bindAudioPolicy(deps)

// Audio only after a user gesture.
document.getElementById('game')?.addEventListener('pointerdown', () => void deps.wind.start(), {
  once: true,
})
