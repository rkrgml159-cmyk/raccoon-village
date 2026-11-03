import type { SpeciesDef } from './types'

export interface ResolvedVariant {
  palette: Record<string, [number, number, number]>
  overlays: string[]
  bodyScale: number
}

export interface ParsedVariant {
  palette: string
  kind?: string
  mask?: string
  tail?: string
  body?: string
}

const AXIS_FIELDS = 5

/** 'grey|common|default|5|normal' (palette|kind|mask|tail|body) or a bare palette name. */
export function parseVariant(v: string): ParsedVariant {
  const parts = v.split('|')
  if (parts.length === 1) return { palette: parts[0] }
  if (parts.length !== AXIS_FIELDS) {
    throw new Error(`variant '${v}': expected ${AXIS_FIELDS} fields`)
  }
  const [palette, kind, mask, tail, body] = parts
  return { palette, kind, mask, tail, body }
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`invalid hex color '${hex}'`)
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

export function resolveVariant(sp: SpeciesDef, variant: string): ResolvedVariant {
  const parsed = parseVariant(variant)
  const hex = sp.palettes[parsed.palette]
  if (!hex) throw new Error(`palette '${parsed.palette}' not found in species ${sp.name}`)
  const palette: Record<string, [number, number, number]> = {}
  for (const [role, color] of Object.entries(hex)) palette[role] = hexToRgb(color)

  const overlays = [...(sp.overlays ?? [])]
  const { axes } = sp
  if (!axes) {
    if (parsed.kind !== undefined) {
      throw new Error(`variant '${variant}' has axes but species has none`)
    }
    return { palette, overlays, bodyScale: 1 }
  }
  if (parsed.kind === undefined)
    throw new Error(`variant '${variant}': expected ${AXIS_FIELDS} fields`)

  const pick = <T>(axis: string, table: Record<string, T>, key: string | undefined): T => {
    if (key === undefined || !Object.prototype.hasOwnProperty.call(table, key)) {
      throw new Error(`${axis} '${key}' not found in species ${sp.name}`)
    }
    return table[key]
  }
  overlays.push(...pick('kind', axes.kind, parsed.kind))
  overlays.push(...pick('mask', axes.mask, parsed.mask))
  overlays.push(...pick('tail', axes.tail, parsed.tail))
  const bodyScale = pick('body', axes.body, parsed.body)
  return { palette, overlays, bodyScale }
}
