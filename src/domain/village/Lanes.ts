export const LANES = [
  { y: 0.62, scale: 0.8 },
  { y: 0.72, scale: 1.0 },
  { y: 0.82, scale: 1.2 },
] as const

export const X_RANGE: readonly [number, number] = [0.05, 0.95]

export function clampX(x: number, range: readonly [number, number] = X_RANGE): number {
  return Math.min(range[1], Math.max(range[0], x))
}

export function toScreen(
  lane: 0 | 1 | 2,
  x: number,
  viewport: { width: number; height: number },
): { px: number; py: number; scale: number } {
  const l = LANES[lane]
  return { px: x * viewport.width, py: l.y * viewport.height, scale: l.scale }
}

/** Shrinks the visible x-range by half a sprite width on both sides; never inverted. */
export function walkRangeFor(
  visible: readonly [number, number],
  halfSpriteFrac: number,
): readonly [number, number] {
  const lo = visible[0] + halfSpriteFrac
  const hi = visible[1] - halfSpriteFrac
  if (lo > hi) {
    const mid = (visible[0] + visible[1]) / 2
    return [mid, mid]
  }
  return [lo, hi]
}
