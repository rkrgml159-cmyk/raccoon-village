import { localParts } from './localParts'

export interface Clock {
  now(): Date
}

export class RealClock implements Clock {
  now(): Date {
    return new Date()
  }
}

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i
const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Epoch ms of wall-clock time `wallMs` (expressed as if UTC) interpreted in `tz`. */
function wallToEpoch(wallMs: number, tz: string): number {
  const offsetAt = (epoch: number): number => {
    const p = localParts(new Date(epoch), tz)
    return (
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(epoch / 60000) * 60000
    )
  }
  const first = wallMs - offsetAt(wallMs)
  return wallMs - offsetAt(first)
}

/** Always returns the same instant. `iso` without an offset is wall time in `tz`. */
export class FixedClock implements Clock {
  private readonly date: Date

  constructor(iso: string, tz = 'Asia/Seoul') {
    const m = WALL.exec(iso)
    if (HAS_OFFSET.test(iso) || !m) {
      this.date = new Date(iso)
      return
    }
    const [, y, mo, d, h, mi, s] = m
    const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0)
    this.date = new Date(wallToEpoch(wall, tz))
  }

  now(): Date {
    return new Date(this.date.getTime())
  }
}

/** Runs `speed`× faster than `real`, starting at `start`. */
export class FastClock implements Clock {
  private readonly createdAt: number

  constructor(
    private readonly start: Date,
    private readonly speed: number,
    private readonly real: Clock = new RealClock(),
  ) {
    this.createdAt = real.now().getTime()
  }

  now(): Date {
    return new Date(
      this.start.getTime() + (this.real.now().getTime() - this.createdAt) * this.speed,
    )
  }
}
