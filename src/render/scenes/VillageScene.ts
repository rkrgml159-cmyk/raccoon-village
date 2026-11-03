import Phaser from 'phaser'
import { Emitter, type GameEvents } from '@domain/events'
import { computeDateContext, type DateContext } from '@domain/time/DateContext'
import { createResident, type Resident } from '@domain/resident/Resident'
import { tick } from '@domain/resident/UtilityAI'
import { LANES, clampX, toScreen } from '@domain/village/Lanes'
import { SkyBlender, getSky } from '@domain/sky/SkyPalette'
import type { BootDeps } from '@app/boot'
import {
  RACCOON_KEYS,
  generateRaccoonTextures,
  registerRaccoonAnims,
} from '../sprites/PlaceholderRaccoon'
import { SkyLayer } from '../sky/SkyLayer'

const RESIZE_DEBOUNCE_MS = 100
const PORTRAIT_RATIO = 1.2
/** Sprite pixels per world unit: a 40px-tall raccoon is ~1/9 of the viewport height. */
const SPRITE_UNITS_PER_VIEW_HEIGHT = 360

export class VillageScene extends Phaser.Scene {
  readonly bus = new Emitter<GameEvents>()

  private resident: Resident = createResident('raccoon-1', 0.5)
  private ctx!: DateContext
  private sky!: SkyLayer
  private blender!: SkyBlender
  private sprite!: Phaser.GameObjects.Sprite
  private debugText?: Phaser.GameObjects.Text
  private walkRange: readonly [number, number] = [0.05, 0.95]
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  private currentAnim = ''
  private stillShown = false

  constructor(private readonly deps: BootDeps) {
    super('village')
  }

  create(): void {
    const { deps } = this
    this.ready = false
    this.currentAnim = ''
    this.stillShown = false
    generateRaccoonTextures(this)
    registerRaccoonAnims(this)

    this.ctx = computeDateContext(deps.clock.now())
    this.sky = new SkyLayer(this, deps.opts.seed ?? 0)
    this.blender = new SkyBlender(getSky(this.ctx.skyKey), deps.blendMs)
    this.sprite = this.add.sprite(0, 0, RACCOON_KEYS.idle[0]).setOrigin(0.5, 1)
    for (const key of [...RACCOON_KEYS.idle, ...RACCOON_KEYS.walk, ...RACCOON_KEYS.sit]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
    if (deps.opts.debug) {
      this.debugText = this.add
        .text(0, 0, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
        .setOrigin(0, 0)
        .setDepth(100)
    }

    const offSeason = this.bus.on('seasonChanged', ({ to }) => deps.wind.setSeason(to))
    deps.wind.setSeason(this.ctx.season)

    this.applyLayout()
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshContext(false) })

    const onResume = (): void => this.refreshContext(true)
    this.game.events.on(Phaser.Core.Events.RESUME, onResume)
    const onResize = (): void => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => this.applyLayout(), RESIZE_DEBOUNCE_MS)
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offSeason()
      this.game.events.off(Phaser.Core.Events.RESUME, onResume)
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize)
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
    })

    window.__rv = {
      ready: false,
      ctx: this.ctx,
      resident: this.resident,
      audio: deps.wind.state,
    }
  }

  update(_t: number, dt: number): void {
    const { deps } = this
    const still = deps.opts.still

    if (still) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      if (!this.stillShown) {
        this.sprite.anims.stop()
        this.sprite.setTexture(RACCOON_KEYS.idle[0])
        this.stillShown = true
      }
    } else {
      const prev = this.resident
      this.resident = tick(
        this.resident,
        dt,
        { phase: this.ctx.phase, walkRange: this.walkRange },
        deps.rng,
      )
      if (this.resident.state !== prev.state) {
        this.bus.emit('residentStateChanged', {
          id: this.resident.id,
          state: this.resident.state,
        })
      }
      this.blender.update(dt)
      const anim = `raccoon-${this.resident.state}`
      if (anim !== this.currentAnim) {
        this.sprite.play(anim)
        this.currentAnim = anim
      }
    }

    this.sky.render(this.blender.current, this.ctx.moonPhase)
    this.placeResident()
    this.updateDebug()

    if (window.__rv) {
      window.__rv.ctx = this.ctx
      window.__rv.resident = this.resident
      window.__rv.audio = deps.wind.state
      if (!this.ready) {
        this.ready = true
        window.__rv.ready = true
      }
    }
  }

  private placeResident(): void {
    const view = { width: this.scale.width, height: this.scale.height }
    const r = this.resident
    const { px, py, scale } = toScreen(r.lane, r.x, view)
    this.sprite
      .setPosition(px, py)
      .setScale((scale * view.height) / SPRITE_UNITS_PER_VIEW_HEIGHT)
      .setFlipX(r.facing === 'left')
      .setDepth(LANES.length + r.lane)
  }

  private refreshContext(snap: boolean): void {
    const prev = this.ctx
    this.ctx = computeDateContext(this.deps.clock.now())
    if (this.ctx.phase !== prev.phase) {
      this.bus.emit('phaseChanged', { from: prev.phase, to: this.ctx.phase })
    }
    if (this.ctx.season !== prev.season) {
      this.bus.emit('seasonChanged', { from: prev.season, to: this.ctx.season })
    }
    if (snap || this.deps.opts.still) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
    } else if (this.ctx.skyKey !== prev.skyKey) {
      this.blender.setTarget(getSky(this.ctx.skyKey))
    }
  }

  private applyLayout(): void {
    const w = this.scale.width
    const h = this.scale.height
    const portrait = w / h < PORTRAIT_RATIO
    this.walkRange = portrait ? [0.3, 0.7] : [0.05, 0.95]
    this.resident = { ...this.resident, x: clampX(this.resident.x, this.walkRange) }
    const cam = this.cameras.main
    // Portrait: zoom 2 centred on x 0.5 so lane x 0.25..0.75 fills the width.
    cam.setZoom(portrait ? 2 : 1)
    const cy = portrait ? h * 0.6 : h / 2
    cam.centerOn(w / 2, cy)
    const vw = w / cam.zoom
    const vh = h / cam.zoom
    this.sky.resize(w, h, { x: w / 2 - vw / 2, y: cy - vh / 2, width: vw, height: vh })
  }

  private updateDebug(): void {
    if (!this.debugText) return
    const cam = this.cameras.main
    const { skyKey, hour, minute } = this.ctx
    const hh = String(hour).padStart(2, '0')
    const mm = String(minute).padStart(2, '0')
    this.debugText
      .setText(`${skyKey} ${hh}:${mm} ${this.resident.state}`)
      .setScale(1 / cam.zoom)
      .setPosition(cam.worldView.x + 4 / cam.zoom, cam.worldView.y + 4 / cam.zoom)
  }
}
