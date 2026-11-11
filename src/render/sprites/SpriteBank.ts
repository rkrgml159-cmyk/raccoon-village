import Phaser from 'phaser'
import { composeFrame } from '@domain/sprites/Compose'
import { resolveVariant } from '@domain/sprites/Palette'
import { animKey, type Registry } from '@domain/sprites/SpriteRegistry'
import type { SpriteState } from '@domain/sprites/types'
import { STATES } from '@domain/sprites/validateRig'

/** Uploads composed pixel-map frames as Phaser textures and registers their animations. */
export class SpriteBank {
  private readonly done = new Set<string>()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: Registry,
  ) {}

  textureKey(species: string, variant: string, state: SpriteState, index: number): string {
    return `${animKey(species, variant, state)}:${index}`
  }

  frameSize(species: string): [number, number] {
    return this.registry.rigs[this.registry.species[species].rig].size
  }

  ensure(species: string, variant: string, states: readonly SpriteState[] = STATES): void {
    const id = `${species}|${variant}|${states.join(',')}`
    if (this.done.has(id)) return
    const { rigs, parts, species: all } = this.registry
    const sp = all[species]
    const rig = rigs[sp.rig]
    const resolved = resolveVariant(sp, variant)
    for (const state of states) {
      const frames = rig.frames[state]
      frames.forEach((_f, index) => {
        const key = this.textureKey(species, variant, state, index)
        if (this.scene.textures.exists(key)) return
        const { w, h, rgba } = composeFrame({ rig, state, index, variant: resolved, parts })
        const tex = this.scene.textures.createCanvas(key, w, h)
        if (!tex) throw new Error(`cannot create texture ${key}`)
        tex
          .getContext()
          .putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
        tex.refresh()
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
      })
      const ak = animKey(species, variant, state)
      if (!this.scene.anims.exists(ak)) {
        this.scene.anims.create({
          key: ak,
          frames: frames.map((_f, index) => ({
            key: this.textureKey(species, variant, state, index),
          })),
          frameRate: rig.frameRate[state],
          repeat: -1,
        })
      }
    }
    this.done.add(id)
  }
}
