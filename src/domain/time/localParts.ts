export interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

let warned = false

function deviceParts(date: Date): LocalParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

/** Wall-clock parts of `date` in `tz`. Invalid tz falls back to device local time (warns once). */
export function localParts(date: Date, tz: string): LocalParts {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(date)
  } catch (e) {
    if (!(e instanceof RangeError)) throw e
    if (!warned) {
      warned = true
      console.warn(`invalid timezone "${tz}", using device local time`)
    }
    return deviceParts(date)
  }
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  }
}
