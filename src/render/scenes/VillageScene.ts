import Phaser from 'phaser'
import { NEED_ICON_KEY, type NeedKey } from '@domain/mind/Needs'
import { Emitter, type GameEvents } from '@domain/events'
import { computeDateContext, type DateContext } from '@domain/time/DateContext'
import { createResident, spriteStateOf, type Resident } from '@domain/resident/Resident'
import { profileFor, type Profile } from '@domain/resident/UtilityAI'
import {
  createVillageState,
  stepVillage,
  type SimEnv,
  type SimEvent,
  type VillageState,
} from '@domain/village/Simulation'
import { scriptFor, facesLeft } from '@domain/social/DuetScript'
import { DUET_TYPES, type DuetType } from '@domain/social/types'
import { BubbleQueue, BUBBLE_TTL, type Bubble } from '@domain/speech/Bubbles'
import { speak, type Mood } from '@domain/speech/Voice'
import { pickThought } from '@domain/speech/Thoughts'
import { bestBand, pickDreamy, pushRecent } from '@domain/speech/Recent'
import { createVillage } from '@domain/village/Village'
import { showcaseLayout } from '@domain/village/Showcase'
import { LANES, clampX, remapX, toScreen, walkRangeFor } from '@domain/village/Lanes'
import { resolveVariant } from '@domain/sprites/Palette'
import { SkyBlender, getSky } from '@domain/sky/SkyPalette'
import type { BootDeps } from '@app/boot'
import { loadRegistry, animKey, defaultVariant, allVariants } from '@domain/sprites/SpriteRegistry'
import {
  BEHAVIOR_TRAITS,
  FOREST,
  PARTS,
  RIGS,
  SPECIES,
  THOUGHTS,
  TILES,
  UI,
} from '@domain/sprites/catalog'
import { STATES } from '@domain/sprites/validateRig'
import { SpriteBank } from '../sprites/SpriteBank'
import { SkyLayer } from '../sky/SkyLayer'
import { ForestLayer } from '../background/ForestLayer'
import { BubbleLayer } from '../ui/BubbleLayer'

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
const DEBUG_DEPTH = 10000
const DUET_PAIR_DX = 0.05
const DUET_COLUMNS = [0.2, 0.5, 0.8]
const MOOD_OF: Partial<Record<DuetType, Mood>> = {
  greet: 'greet',
  chat: 'chat',
  groom: 'soft',
  makeUp: 'greet',
  quarrel: 'upset',
}
/** Wallpaper auto-thought cadence, in real (not simulated) milliseconds. */
const WALLPAPER_THOUGHT_MS = 10 * 60 * 1000
/** A duet counts as "just happened" for thought selection for this long (sim ms). */
const AFTER_DUET_MS = 120_000
const fmt = (v: number): string => v.toFixed(1).replace(/^0/, '')
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
  private sim!: VillageState
  private env!: SimEnv
  private bubbles = new BubbleQueue()
  private bubbleLayer?: BubbleLayer
  /** Last thought lines per resident (window of 10), so a tapped resident does not repeat itself. */
  private recentThoughts = new Map<string, string[]>()
  private indexOf = new Map<string, number>()
  private flipLeft: boolean[] = []
  private offsets: number[] = []
  private positions: { x: number; y: number }[] = []
  private ctx!: DateContext
  private sky!: SkyLayer
  private forest!: ForestLayer
  private blender!: SkyBlender
  private bank!: SpriteBank
  private sheetSprites: Phaser.GameObjects.Image[] = []
  private debugText?: Phaser.GameObjects.Text
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  private stillShown = false
  private laidOut = false

  constructor(private readonly deps: BootDeps) {
    super('village')
  }

  create(): void {
    const { deps } = this
    this.ready = false
    this.stillShown = false
    this.laidOut = false
    try {
      this.bank = new SpriteBank(this, loadRegistry({ rigs: RIGS, parts: PARTS, species: SPECIES }))
    } catch (e) {
      console.error('registry invalid', e)
      return
    }
    this.sheetSprites = []
    this.walkRanges.clear()
    this.profiles.clear()

    this.ctx = computeDateContext(deps.clock.now())
    this.sky = new SkyLayer(this, deps.opts.seed ?? 0)
    this.forest = new ForestLayer(this, FOREST, TILES, deps.opts.seed ?? 0)
    this.blender = new SkyBlender(getSky(this.ctx.skyKey), deps.blendMs)
    this.residents = this.makeResidents()
    for (const sp of new Set(this.residents.map((r) => r.species)))
      this.profiles.set(sp, profileFor(SPECIES[sp]))
    this.animKeys = this.residents.map(() => '')
    this.bubbles = new BubbleQueue()
    this.recentThoughts.clear()
    this.bubbleLayer = new BubbleLayer(this, this.bubbles)
    this.indexOf = new Map(this.residents.map((r, i) => [r.id, i]))
    this.flipLeft = this.residents.map((r) => r.facing === 'left')
    this.offsets = this.residents.map(() => 0)
    this.positions = this.residents.map(() => ({ x: 0, y: 0 }))
    this.sim = createVillageState(this.residents, deps.opts.seed ?? 0)
    this.residents = this.sim.residents
    this.env = {
      phase: this.ctx.phase,
      speed: deps.opts.speed,
      walkRangeOf: (id) => this.walkRanges.get(id) ?? X_FALLBACK,
      profileOf: (sp) => this.profiles.get(sp) as Profile,
      nocturnalOf: (sp) => SPECIES[sp].nocturnal ?? false,
      traitTable: BEHAVIOR_TRAITS,
    }
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
        .setDepth(DEBUG_DEPTH)
    }

    if (this.interactive && deps.mode === 'play') {
      this.sprites.forEach((sprite, i) => {
        sprite.setInteractive()
        sprite.on('pointerup', () => this.thinkAloud(i, true))
      })
    }
    if (this.interactive && deps.mode === 'wallpaper') {
      this.time.addEvent({
        delay: WALLPAPER_THOUGHT_MS,
        loop: true,
        callback: () => this.autoThought(),
      })
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
      this.bubbleLayer?.destroy()
      this.bubbleLayer = undefined
      this.forest.destroy()
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
      duets: this.sim.duets,
      duetLog: this.sim.duetLog,
      bubbles: [],
      minds: deps.opts.debug ? this.sim.minds : undefined,
      positions: this.positions,
    }
  }

  update(_t: number, dt: number): void {
    const { deps } = this
    const still = deps.opts.still || this.showcase || this.duetMode
    const sheet = this.sheetSprites.length > 0

    if (sheet) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      this.placeSheet()
    } else if (still) {
      this.blender.snapTo(getSky(this.ctx.skyKey))
      if (!this.stillShown) {
        this.residents.forEach((r, i) => {
          const cue = this.duetMode ? this.stillCue(i) : undefined
          this.sprites[i].anims.stop()
          this.sprites[i].setTexture(
            this.bank.textureKey(r.species, r.variant, cue?.anim ?? 'idle', 0),
          )
          if (cue) {
            const partner = this.residents[i ^ 1]
            this.flipLeft[i] = facesLeft(cue.flip, r.x, partner.x, r.facing === 'left')
            this.offsets[i] = cue.offsetX
          }
        })
        this.stillShown = true
      }
    } else {
      this.blender.update(dt)
      this.stepSim(dt)
    }

    this.forest.render(this.ctx.season, this.blender.current)
    this.sky.setGroundY(this.forest.groundTop)
    this.sky.render(this.blender.current, this.ctx.moonPhase)
    if (!sheet) this.placeResidents()
    this.updateDebug()
    const alive = this.syncBubbles()

    if (window.__rv) {
      window.__rv.ctx = this.ctx
      window.__rv.residents = this.residents
      window.__rv.resident = this.residents[0]
      window.__rv.audio = deps.wind.state
      window.__rv.duets = this.sim.duets
      if (deps.opts.debug) window.__rv.minds = this.sim.minds
      window.__rv.duetLog = this.sim.duetLog
      window.__rv.bubbles = alive
      if (!this.ready) {
        this.ready = true
        window.__rv.ready = true
      }
    }
  }

  /** True when the sim runs live (no still/showcase/sheet/duet), i.e. bubbles make sense. */
  private get interactive(): boolean {
    const o = this.deps.opts
    return !o.still && !this.showcase && !this.duetMode && !(o.sheet && SPECIES[o.sheet])
  }

  private syncBubbles(): Bubble[] {
    const now = this.time.now
    const alive = this.bubbles.tick(now)
    this.bubbleLayer?.sync(
      alive,
      now,
      (id) => {
        const i = this.indexOf.get(id)
        if (i === undefined) return undefined
        const sp = this.sprites[i]
        return { x: sp.x, y: sp.y, height: sp.displayHeight }
      },
      this.cameras.main.worldView,
    )
    return alive
  }

  /** Tap (or wallpaper timer) thought for resident `i`; `mark` appends the relation mark from ui.json. */
  private thinkAloud(i: number, mark: boolean): void {
    const r = this.residents[i]
    const mind = r ? this.sim.minds[r.id] : undefined
    if (!r || !mind) return
    const band = bestBand(this.sim.relations.snapshot(), r.id)
    const last = [...this.sim.duetLog]
      .reverse()
      .find((d) => (d.a === r.id || d.b === r.id) && this.sim.simMs - d.at <= AFTER_DUET_MS)
    const recent = this.recentThoughts.get(r.id) ?? []
    const line = pickThought(
      {
        lastDuet: last?.type,
        needs: mind.needs,
        band,
        phase: this.ctx.phase,
        season: this.ctx.season,
        traits: mind.traits,
        species: r.species,
        // The sim does not track idle time per resident and no situation reads it yet.
        idleMs: 0,
      },
      THOUGHTS,
      recent,
      this.deps.rng,
    )
    if (line === null) return
    this.recentThoughts.set(r.id, pushRecent(recent, line))
    const tail = mark && band ? UI.relationMarks[band] : ''
    this.bubbles.push(
      {
        residentId: r.id,
        kind: 'thought',
        text: tail ? `${line} ${tail}` : line,
        ttlMs: BUBBLE_TTL.thought,
      },
      this.time.now,
    )
  }

  private autoThought(): void {
    const pick = pickDreamy(
      this.residents.map((r, i) => ({
        i,
        dreamer: this.sim.minds[r.id]?.traits.includes('dreamer') ?? false,
      })),
      this.deps.rng,
    )
    if (pick) this.thinkAloud(pick.i, false)
  }

  private stillCue(i: number): ReturnType<typeof scriptFor> {
    const type = this.duetTypeOf(i >> 1)
    return scriptFor(type, 0, i % 2 === 0 ? 'a' : 'b')
  }

  private duetTypeOf(pair: number): DuetType {
    const d = this.deps.opts.duet
    return d === 'all' || d === undefined ? DUET_TYPES[pair % DUET_TYPES.length] : d
  }

  private stepSim(dt: number): void {
    this.env.phase = this.ctx.phase
    const { state, events } = stepVillage(this.sim, dt, this.env, this.deps.rng)
    this.sim = state
    this.residents = state.residents
    const now = this.time.now
    for (const ev of events) this.handleEvent(ev, now)
    for (let i = 0; i < this.residents.length; i++) this.pose(i)
  }

  private handleEvent(ev: SimEvent, now: number): void {
    switch (ev.kind) {
      case 'state':
        this.bus.emit('residentStateChanged', { id: ev.id, state: ev.state })
        break
      case 'duetStart':
        this.bus.emit('duetStarted', { duet: ev.duet })
        break
      case 'duetEnd':
        this.bus.emit('duetEnded', { duet: ev.duet })
        break
      case 'speak': {
        const mood = MOOD_OF[ev.duet.type]
        const idx = this.indexOf.get(ev.id)
        if (!mood || idx === undefined) break
        const text = speak(SPECIES[this.residents[idx].species].voice, mood, this.deps.rng)
        this.bubbles.push(
          { residentId: ev.id, kind: 'speech', text, ttlMs: BUBBLE_TTL.speech },
          now,
        )
        break
      }
      case 'icon': {
        const glyph = UI.icons[NEED_ICON_KEY[ev.icon as NeedKey] ?? ev.icon]
        if (glyph === undefined) break
        const b: Omit<Bubble, 'id' | 'bornMs'> = {
          residentId: ev.id,
          kind: 'icon',
          text: glyph,
          ttlMs: BUBBLE_TTL.icon,
        }
        this.bubbles.push(b, now)
        break
      }
      default:
        break
    }
  }

  /** Picks the animation, facing and offset of resident `i` from its sim state. */
  private pose(i: number): void {
    const r = this.residents[i]
    let key: string
    let left = r.facing === 'left'
    let offset = 0
    const duet =
      r.state === 'duet' && r.duetId !== undefined
        ? this.sim.duets.find((d) => d.id === r.duetId)
        : undefined
    if (duet) {
      const role = duet.a === r.id ? 'a' : 'b'
      const cue = scriptFor(duet.type, duet.step, role)
      key = animKey(r.species, r.variant, cue.anim)
      const partner = this.residents[this.indexOf.get(role === 'a' ? duet.b : duet.a) ?? i]
      left = facesLeft(cue.flip, r.x, partner.x, left)
      offset = cue.offsetX
    } else {
      key = animKey(r.species, r.variant, spriteStateOf(r.state))
    }
    this.flipLeft[i] = left
    this.offsets[i] = offset
    if (key !== this.animKeys[i]) {
      this.sprites[i].play(key)
      this.animKeys[i] = key
    }
  }

  private buildSheet(id: string): void {
    const variant = defaultVariant(SPECIES[id])
    this.bank.ensure(id, variant, STATES)
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
    const rows = STATES.length
    // Shrink only when the rows would overflow the view (the nine-state sheet).
    const scale = Math.min(spriteScale(1, view), view.height / (rows * fh * SHEET_GAP_Y))
    const dx = fw * scale * SHEET_GAP_X
    const dy = fh * scale * SHEET_GAP_Y
    const top = view.height / 2 - (dy * rows) / 2 + dy
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
      const cam = this.cameras.main
      const pos = this.positions[i]
      // World to screen from scroll and zoom (valid from the first frame, unlike worldView).
      const fx = px + this.offsets[i] * view.width
      pos.x = (fx - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2
      pos.y = (py - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2
      this.sprites[i]
        .setPosition(px + this.offsets[i] * view.width, py)
        .setScale(spriteScale(scale, view) * r.scale)
        .setFlipX(this.flipLeft[i])
        .setDepth(r.lane * 1000 + py)
    }
  }

  private get duetMode(): boolean {
    return this.deps.opts.duet !== undefined
  }

  private get showcase(): boolean {
    return this.deps.opts.species === 'all'
  }

  /** Residents are born inside the portrait visible range, so they need no remap afterwards. */
  private spawnRange(): readonly [number, number] {
    return this.isPortrait() ? VISIBLE_X.portrait : X_FALLBACK
  }

  private isPortrait(): boolean {
    return this.scale.width / this.scale.height < PORTRAIT_RATIO
  }

  private makeResidents(): Resident[] {
    const { opts } = this.deps
    const bodyScaleOf = (id: string, v: string): number => resolveVariant(SPECIES[id], v).bodyScale
    if (this.duetMode) return this.duetResidents()
    if (!this.showcase) {
      return createVillage({
        seed: opts.seed ?? 0,
        n: opts.n,
        species: SPECIES,
        variantsOf: (_id, sp) => allVariants(sp),
        bodyScaleOf,
        halfWidthOf: (id, scale, lane) => {
          const view = { width: this.scale.width, height: this.scale.height }
          const display = spriteScale(LANES[lane].scale, view) * scale
          return ((this.bank.frameSize(id)[0] / 2) * display) / view.width
        },
        range: this.spawnRange(),
      })
    }
    return showcaseLayout(SPECIES).map(({ id, lane, x }) => {
      const variant = defaultVariant(SPECIES[id])
      return createResident(id, x, {
        species: id,
        variant,
        lane,
        scale: SPECIES[id].scale * bodyScaleOf(id, variant),
      })
    })
  }

  /** Duet still mode: pairs of default raccoons, a left of b, three lanes by three columns. */
  private duetResidents(): Resident[] {
    const variant = defaultVariant(SPECIES[RESIDENT_SPECIES])
    const scale =
      SPECIES[RESIDENT_SPECIES].scale * resolveVariant(SPECIES[RESIDENT_SPECIES], variant).bodyScale
    const pairs = this.deps.opts.duet === 'all' ? DUET_TYPES.length : 1
    const out: Resident[] = []
    for (let p = 0; p < pairs; p++) {
      const lane = (pairs === 1 ? 1 : p % 3) as 0 | 1 | 2
      const cx = pairs === 1 ? 0.5 : DUET_COLUMNS[Math.floor(p / 3)]
      const init = { species: RESIDENT_SPECIES, variant, lane, scale }
      out.push(createResident(`d${p}a`, cx - DUET_PAIR_DX, init))
      out.push({ ...createResident(`d${p}b`, cx + DUET_PAIR_DX, init), facing: 'left' })
    }
    return out
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
    const portrait = this.isPortrait()
    const view = { width: w, height: h }
    // Only a spawn over the full width needs remapping into the visible range.
    const remap = !this.laidOut && !portrait
    const visible = portrait ? VISIBLE_X.portrait : VISIBLE_X.landscape
    this.residents = this.residents.map((r) => {
      const displayScale = spriteScale(LANES[r.lane].scale, view) * r.scale
      const halfSpriteFrac = ((this.bank.frameSize(r.species)[0] / 2) * displayScale) / w
      const range = walkRangeFor(visible, halfSpriteFrac)
      this.walkRanges.set(r.id, range)
      if (this.showcase || this.duetMode) return r
      const x = remap ? remapX(r.x, X_FALLBACK, range) : clampX(r.x, range)
      return { ...r, x }
    })
    this.laidOut = true
    if (this.sim) this.sim.residents = this.residents
    const cam = this.cameras.main
    // Portrait: zoom 2 centred on x 0.5 so lane x 0.25..0.75 fills the width.
    cam.setZoom(portrait ? 2 : 1)
    const cy = portrait ? h * 0.6 : h / 2
    cam.centerOn(w / 2, cy)
    const vw = w / cam.zoom
    const vh = h / cam.zoom
    const viewRect = { x: w / 2 - vw / 2, y: cy - vh / 2, width: vw, height: vh }
    this.sky.resize(w, h, viewRect)
    this.forest.resize(w, h, viewRect)
  }

  private updateDebug(): void {
    if (!this.debugText) return
    const cam = this.cameras.main
    const { skyKey, hour, minute } = this.ctx
    const hh = String(hour).padStart(2, '0')
    const mm = String(minute).padStart(2, '0')
    const lines = [`${skyKey} ${hh}:${mm} ${this.residents[0]?.state ?? ''}`]
    for (const r of this.residents) {
      const m = this.sim.minds[r.id]
      const n = m.needs
      let line = `${r.id} H${fmt(n.hunger)} S${fmt(n.sleepy)} B${fmt(n.bored)} L${fmt(n.lonely)} ${m.traits.join('/')}`
      const d = r.duetId === undefined ? undefined : this.sim.duets.find((x) => x.id === r.duetId)
      if (d) line += ` [${d.type} ${((d.durationMs - d.t) / 1000).toFixed(1)}s]`
      lines.push(line)
    }
    this.debugText
      .setText(lines.join('\n'))
      .setScale(1 / cam.zoom)
      .setPosition(cam.worldView.x + 4 / cam.zoom, cam.worldView.y + 4 / cam.zoom)
  }
}
