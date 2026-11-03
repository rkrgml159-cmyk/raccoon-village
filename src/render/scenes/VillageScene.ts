import Phaser from 'phaser'
import { Emitter, type GameEvents } from '@domain/events'
import { computeDateContext, type DateContext } from '@domain/time/DateContext'
import { createResident, type Resident } from '@domain/resident/Resident'
import { tick } from '@domain/resident/UtilityAI'
import { LANES, clampX, toScreen, walkRangeFor } from '@domain/village/Lanes'
import { SkyBlender, getSky } from '@domain/sky/SkyPalette'
import type { BootDeps } from '@app/boot'
import { loadRegistry, animKey, defaultVariant } from '@domain/sprites/SpriteRegistry'
import { PARTS, RIGS, SPECIES } from '@domain/sprites/catalog'
import { STATES } from '@domain/sprites/validateRig'
import { SpriteBank } from '../sprites/SpriteBank'
import { SkyLayer } from '../sky/SkyLayer'

const RESIZE_DEBOUNCE_MS = 100
const PORTRAIT_RATIO = 1.2
/** Sprite pixels per world unit: a 40px-tall raccoon is ~1/9 of the viewport height. */
const SPRITE_UNITS_PER_VIEW_HEIGHT = 360
/** Screen pixels per sprite pixel at lane scale 1 on a 360-unit view. */
const PX = 1.5
const SHEET_GAP_X = 1.2
const SHEET_GAP_Y = 1.3
const RESIDENT_SPECIES = 'raccoon'
const VISIBLE_X = { portrait: [0.25, 0.75], landscape: [0.05, 0.95] } as const

/** Sprite scale: lane scale × the short viewport side (so portrait phones get a small raccoon). */
function spriteScale(laneScale: number, view: { width: number; height: number }): number {
  return (laneScale * PX * Math.min(view.width, view.height)) / SPRITE_UNITS_PER_VIEW_HEIGHT
}

export class VillageScene extends Phaser.Scene {
  readonly bus = new Emitter<GameEvents>()

  private resident: Resident = createResident('raccoon-1', 0.5)
  private ctx!: DateContext
  private sky!: SkyLayer
  private blender!: SkyBlender
  private sprite!: Phaser.GameObjects.Sprite
  private bank!: SpriteBank
  private variant = ''
  private sheetSprites: Phaser.GameObjects.Image[] = []
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
    this.bank = new SpriteBank(this, loadRegistry({ rigs: RIGS, parts: PARTS, species: SPECIES }))
    this.variant = defaultVariant(SPECIES[RESIDENT_SPECIES])
    this.bank.ensure(RESIDENT_SPECIES, this.variant)
    this.sheetSprites = []

    this.ctx = computeDateContext(deps.clock.now())
    this.sky = new SkyLayer(this, deps.opts.seed ?? 0)
    this.blender = new SkyBlender(getSky(this.ctx.skyKey), deps.blendMs)
    this.sprite = this.add
      .sprite(0, 0, this.bank.textureKey(RESIDENT_SPECIES, this.variant, 'idle', 0))
      .setOrigin(0.5, 1)
    if (deps.opts.sheet && SPECIES[deps.opts.sheet]) {
      this.sprite.setVisible(false)
      this.buildSheet(deps.opts.sheet)
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
    const sheet = this.sheetSprites.length > 0

    if (sheet) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      this.placeSheet()
    } else if (still) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      if (!this.stillShown) {
        this.sprite.anims.stop()
        this.sprite.setTexture(this.bank.textureKey(RESIDENT_SPECIES, this.variant, 'idle', 0))
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
      const anim = animKey(RESIDENT_SPECIES, this.variant, this.resident.state)
      if (anim !== this.currentAnim) {
        this.sprite.play(anim)
        this.currentAnim = anim
      }
    }

    this.sky.render(this.blender.current, this.ctx.moonPhase)
    if (!sheet) this.placeResident()
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

  private buildSheet(id: string): void {
    const variant = defaultVariant(SPECIES[id])
    this.bank.ensure(id, variant)
    const rig = RIGS[SPECIES[id].rig]
    for (const state of STATES) {
      rig.frames[state].forEach((_f, index) => {
        const img = this.add
          .image(0, 0, this.bank.textureKey(id, variant, state, index))
          .setOrigin(0.5, 1)
          .setData('row', STATES.indexOf(state))
          .setData('col', index)
        this.sheetSprites.push(img)
      })
    }
  }

  private placeSheet(): void {
    const view = { width: this.scale.width, height: this.scale.height }
    const [fw, fh] = this.bank.frameSize(this.deps.opts.sheet ?? RESIDENT_SPECIES)
    const scale = spriteScale(1, view)
    const dx = fw * scale * SHEET_GAP_X
    const dy = fh * scale * SHEET_GAP_Y
    const top = view.height / 2 - (dy * STATES.length) / 2 + dy
    for (const img of this.sheetSprites) {
      const row = img.getData('row') as number
      const col = img.getData('col') as number
      const count = this.sheetSprites.filter((o) => o.getData('row') === row).length
      img
        .setScale(scale)
        .setPosition(view.width / 2 + (col - (count - 1) / 2) * dx, top + row * dy)
        .setDepth(10)
    }
  }

  private placeResident(): void {
    const view = { width: this.scale.width, height: this.scale.height }
    const r = this.resident
    const { px, py, scale } = toScreen(r.lane, r.x, view)
    this.sprite
      .setPosition(px, py)
      .setScale(spriteScale(scale, view))
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
    const laneScale = LANES[this.resident.lane].scale
    const halfSpriteFrac =
      ((this.bank.frameSize(RESIDENT_SPECIES)[0] / 2) *
        spriteScale(laneScale, { width: w, height: h })) /
      w
    this.walkRange = walkRangeFor(
      portrait ? VISIBLE_X.portrait : VISIBLE_X.landscape,
      halfSpriteFrac,
    )
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
