import ui from '../../data/ui.json'
import { bindPower, createGame, makeDeps } from './boot'

const CURSOR_HIDE_MS = 3000

const deps = makeDeps('wallpaper')
const game = createGame(deps)
bindPower(game, deps)

const container = document.getElementById('ui')
if (container) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = ui.soundOn
  button.addEventListener('click', async () => {
    await deps.wind.start()
    button.remove()
  })
  container.appendChild(button)
}

let cursorTimer: ReturnType<typeof setTimeout> | undefined
const hideCursorSoon = (): void => {
  document.body.style.cursor = ''
  clearTimeout(cursorTimer)
  cursorTimer = setTimeout(() => {
    document.body.style.cursor = 'none'
  }, CURSOR_HIDE_MS)
}
window.addEventListener('pointermove', hideCursorSoon)
hideCursorSoon()
