import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import type { Page } from '@playwright/test'
import { launchBrowser, parseArgs, startPreview, stopPreview, waitForUrl } from './lib'

const PORT = 4177
const AT = '2026-04-10T12:00'
const SEASON_DAYS = ['2026-04-10', '2026-07-10', '2026-10-10', '2026-01-10']
const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter']
const PHASE_TIMES = [
  ['dawn', '05:30'],
  ['day', '12:00'],
  ['dusk', '18:00'],
  ['night', '23:00'],
]

async function shoot(page: Page, url: string, file: string): Promise<void> {
  await page.goto(url)
  await page.waitForFunction(
    () => (window as unknown as { __rv?: { ready?: boolean } }).__rv?.ready === true,
  )
  await page.waitForTimeout(300)
  await page.screenshot({ path: file })
  console.log(file)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const outDir = resolve(args.out ?? 'captures')
  mkdirSync(outDir, { recursive: true })
  let server: ChildProcess | undefined
  try {
    server = startPreview(PORT)
    const base = `http://localhost:${PORT}/raccoon-village/`
    await waitForUrl(base)
    const browser = await launchBrowser()
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      const at = encodeURIComponent(AT)
      if (args.species === 'all') {
        await shoot(page, `${base}?species=all&at=${at}&still=1`, join(outDir, 'showcase.png'))
      } else if (args.bg !== '1') {
        const id = args.sheet ?? 'raccoon'
        await shoot(page, `${base}?sheet=${id}&at=${at}&still=1`, join(outDir, `sheet-${id}.png`))
      }
      if (args.bg === '1') {
        for (let s = 0; s < SEASON_DAYS.length; s++) {
          for (const [phase, time] of PHASE_TIMES) {
            const t = encodeURIComponent(`${SEASON_DAYS[s]}T${time}`)
            const file = join(outDir, `bg-${SEASON_NAMES[s]}-${phase}.png`)
            await shoot(page, `${base}?at=${t}&still=1&seed=1`, file)
          }
        }
      }
    } finally {
      await browser.close()
    }
  } finally {
    stopPreview(server)
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
