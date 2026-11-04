export type SpriteState = 'idle' | 'walk' | 'sit' | 'sleep'

export interface Frame {
  rows: string[]
  anchors: Record<string, [number, number]>
}

export interface RigDef {
  id: string
  size: [number, number]
  frames: Record<SpriteState, Frame[]>
  frameRate: Record<SpriteState, number>
}

export interface PartVariant {
  offset: [number, number]
  rows: string[]
}

export interface PartDef extends PartVariant {
  id: string
  rigs: string[]
  anchor: string
  layer: 'above' | 'below'
  fixed?: string
  states?: Partial<Record<SpriteState, PartVariant>>
}

export interface Weights {
  idle: number
  walk: number
  sit: number
  sleep: number
  forage?: number
  approach?: number
}

export interface SpeciesDef {
  name: string
  rig: string
  scale: number
  share: number
  lanes?: [number, number, number]
  walkSpeed?: number
  nocturnal?: boolean
  weights?: { default: Weights; night: Weights }
  palettes: Record<string, Record<string, string>>
  overlays?: string[]
  axes?: {
    kind: Record<string, string[]>
    mask: Record<string, string[]>
    tail: Record<string, string[]>
    body: Record<string, number>
  }
}

export interface TileDef {
  id: string
  size: [number, number]
  rows: string[]
  ground: number
}

export interface SceneLayer {
  id: 'back' | 'mid' | 'front'
  y: number
  scale: number
  density: number
  tint?: 'horizon'
  alpha?: number
  tiles: { id: string; w: number; min?: number; max?: number }[]
}

export interface SceneDef {
  ground: { y: number }
  layers: SceneLayer[]
  palettes: Record<'spring' | 'summer' | 'autumn' | 'winter', Record<string, string>>
}

/** cells[y * w + x] holds the role character for that pixel. */
export interface PixelMap {
  w: number
  h: number
  cells: string[]
}
