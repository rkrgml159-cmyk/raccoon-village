import Phaser from 'phaser'
import { Emitter, type GameEvents } from '@domain/events'
import { computeDateContext, type DateContext } from '@domain/time/DateContext'
import { createResident, type Resident } from '@domain/resident/Resident'
import { tick, profileFor, type Profile } from '@domain/resident/UtilityAI'
import { createVillage } from '@domain/village/Village'
import { LANES, clampX, toScreen, walkRangeFor } from '@domain/village/Lanes'
import { resolveVariant } from '@domain/sprites/Palette'
import { SkyBlender, getSky } from '@domain/sky/SkyPalette'
import type { BootDeps } from '@app/boot'
import { loadRegistry, animKey, defaultVariant, allVariants } from '@domain/sprites/SpriteRegistry'
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
const X_FALLBACK = [0.05, 0.95] as const
const SHOWCASE_MARGIN = 0.08
const VISIBLE_X = { portrait: [0.25, 0.75], landscape: [0.05, 0.95] } as const

/** Sprite scale: lane scale × the short viewport side (so portrait phones get a small raccoon). */
function spriteScale(laneScale: number, view: { width: number; height: number }): number {
  return (laneScale * PX * Math.min(view.width, view.height)) / SPRITE_UNITS_PER_VIEW_HEIGHT
}

export class VillageScene extends Phaser.Scene {
  readonly bus = new Emitter<GameEvents>()

  private residents: Resident[] = []
  private sprites: Phaser.GameObjects.Sprite[] = []
  private animKeys: string[] = []
  private walkRanges = new Map<string, readonly [number, number]>()
  private profiles = new Map<string, Profile>()
  private ctx!: DateContext
  private sky!: SkyLayer
  private blender!: SkyBlender
  private bank!: SpriteBank
  private sheetSprites: Phaser.GameObjects.Image[] = []
  private debugText?: Phaser.GameObjects.Text
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  private stillShown = false

  constructor(private readonly deps: BootDeps) {
    super('village')
  }

  create(): void {
    const { deps } = this
    this.ready = false
    this.stillShown = false
    this.bank = new SpriteBank(this, loadRegistry({ rigs: RIGS, parts: PARTS, species: SPECIES }))
    this.sheetSprites = []
    this.walkRanges.clear()
    this.profiles.clear()

    this.ctx = computeDateContext(deps.clock.now())
    this.sky = new SkyLayer(this, deps.opts.seed ?? 0)
    this.blender = new SkyBlender(getSky(this.ctx.skyKey), deps.blendMs)
    this.residents = this.makeResidents()
    for (const sp of new Set(this.residents.map((r) => r.species)))
      this.profiles.set(sp, profileFor(SPECIES[sp]))
    this.animKeys = this.residents.map(() => '')
    this.sprites = this.residents.map((r) => {
      this.bank.ensure(r.species, r.variant)
      return this.add
        .sprite(0, 0, this.bank.textureKey(r.species, r.variant, 'idle', 0))
        .setOrigin(0.5, 1)
    })
    if (deps.opts.sheet && SPECIES[deps.opts.sheet]) {
      for (const sprite of this.sprites) sprite.setVisible(false)
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
      residents: this.residents,
      resident: this.residents[0],
      audio: deps.wind.state,
    }
  }

  update(_t: number, dt: number): void {
    const { deps } = this
    const still = deps.opts.still || this.showcase
    const sheet = this.sheetSprites.length > 0

    if (sheet) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      this.placeSheet()
    } else if (still) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      if (!this.stillShown) {
        this.residents.forEach((r, i) => {
          this.sprites[i].anims.stop()
          this.sprites[i].setTexture(this.bank.textureKey(r.species, r.variant, 'idle', 0))
        })
        this.stillShown = true
      }
    } else {
      this.blender.update(dt)
      for (let i = 0; i < this.residents.length; i++) {
        const prev = this.residents[i]
        const next = tick(
          prev,
          dt,
          {
            phase: this.ctx.phase,
            walkRange: this.walkRanges.get(prev.id) ?? X_FALLBACK,
            profile: this.profiles.get(prev.species) as Profile,
          },
          deps.rng,
        )
        this.residents[i] = next
        if (next.state !== prev.state) {
          this.bus.emit('residentStateChanged', { id: next.id, state: next.state })
        }
        const anim = animKey(next.species, next.variant, next.state)
        if (anim !== this.animKeys[i]) {
          this.sprites[i].play(anim)
          this.animKeys[i] = anim
        }
      }
    }

    this.sky.render(this.blender.current, this.ctx.moonPhase)
    if (!sheet) this.placeResidents()
    this.updateDebug()

    if (window.__rv) {
      window.__rv.ctx = this.ctx
      window.__rv.residents = this.residents
      window.__rv.resident = this.residents[0]
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

  private placeResidents(): void {
    const view = { width: this.scale.width, height: this.scale.height }
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i]
      const { px, py, scale } = toScreen(r.lane, r.x, view)
      this.sprites[i]
        .setPosition(px, py)
        .setScale(spriteScale(scale, view) * r.scale)
        .setFlipX(r.facing === 'left')
        .setDepth(r.lane * 1000 + py)
    }
  }

  private get showcase(): boolean {
    return this.deps.opts.species === 'all'
  }

  private makeResidents(): Resident[] {
    const { opts } = this.deps
    const bodyScaleOf = (id: string, v: string): number => resolveVariant(SPECIES[id], v).bodyScale
    if (!this.showcase) {
      return createVillage({
        seed: opts.seed ?? 0,
        n: opts.n,
        species: SPECIES,
        variantsOf: (_id, sp) => allVariants(sp),
        bodyScaleOf,
      })
    }
    const ids = Object.keys(SPECIES)
    return ids.map((id, i) => {
      const lane = (i % 3) as 0 | 1 | 2
      const inLane = Math.ceil((ids.length - lane) / 3)
      const idx = Math.floor(i / 3)
      const x =
        SHOWCASE_MARGIN +
        (inLane > 1 ? idx * ((1 - 2 * SHOWCASE_MARGIN) / (inLane - 1)) : 0.5 - SHOWCASE_MARGIN)
      const variant = defaultVariant(SPECIES[id])
      return createResident(id, x, {
        species: id,
        variant,
        lane,
        scale: SPECIES[id].scale * bodyScaleOf(id, variant),
      })
    })
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
    const view = { width: w, height: h }
    const visible = portrait ? VISIBLE_X.portrait : VISIBLE_X.landscape
    this.residents = this.residents.map((r) => {
      const displayScale = spriteScale(LANES[r.lane].scale, view) * r.scale
      const halfSpriteFrac = ((this.bank.frameSize(r.species)[0] / 2) * displayScale) / w
      const range = walkRangeFor(visible, halfSpriteFrac)
      this.walkRanges.set(r.id, range)
      return this.showcase ? r : { ...r, x: clampX(r.x, range) }
    })
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
      .setText(`${skyKey} ${hh}:${mm} ${this.residents[0]?.state ?? ''}`)
      .setScale(1 / cam.zoom)
      .setPosition(cam.worldView.x + 4 / cam.zoom, cam.worldView.y + 4 / cam.zoom)
  }
}
