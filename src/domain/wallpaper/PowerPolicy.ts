export type Mode = 'play' | 'wallpaper'

export interface PowerInput {
  mode: Mode
  hidden: boolean
  reducedMotion: boolean
}

export interface PowerOutput {
  targetFps: number
  particleCap: number
  audioAllowed: boolean
}

export function policy(i: PowerInput): PowerOutput {
  const wall = i.mode === 'wallpaper'
  return {
    targetFps: i.hidden ? 0 : wall ? 30 : 60,
    particleCap: i.reducedMotion ? 0 : wall ? 60 : 200,
    audioAllowed: !i.hidden,
  }
}
