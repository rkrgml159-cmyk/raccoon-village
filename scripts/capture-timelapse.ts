import { mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { launchBrowser, parseArgs, sleep, startPreview, stopPreview, waitForUrl } from './lib'

const PORT = 4174

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const at = args.at ?? '2026-10-10T05:00'
  const seconds = Number(args.seconds ?? 150)
  const outDir = resolve(args.out ?? 'captures')
  mkdirSync(outDir, { recursive: true })
  const tmpDir = join(outDir, '.rec-tmp')
  rmSync(tmpDir, { recursive: true, force: true })

  let server: ChildProcess | undefined
  try {
    server = startPreview(PORT)
    const base = `http://localhost:${PORT}/raccoon-village/`
    await waitForUrl(base)
    const browser = await launchBrowser()
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tmpDir, size: { width: 1920, height: 1080 } },
      })
      const page = await context.newPage()
      const video = page.video()
      await page.goto(`${base}w/?at=${encodeURIComponent(at)}&speed=600&seed=1`)
      await page.waitForFunction(
        () => (window as unknown as { __rv?: { ready?: boolean } }).__rv?.ready === true,
      )
      await sleep(seconds * 1000)
      await context.close()
      if (!video) throw new Error('no video recorded')
      const target = join(outDir, `timelapse-${at.replace(/[^0-9A-Za-z]+/g, '-')}.webm`)
      renameSync(await video.path(), target)
      console.log(`${target} ${(statSync(target).size / 1024).toFixed(0)} KB`)
    } finally {
      await browser.close()
    }
    rmSync(tmpDir, { recursive: true, force: true })
  } finally {
    stopPreview(server)
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
