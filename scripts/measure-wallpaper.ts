import { mkdirSync, writeFileSync } from 'node:fs'
import type { ChildProcess } from 'node:child_process'
import { launchBrowser, parseArgs, sleep, startPreview, stopPreview, waitForUrl } from './lib'

const PORT = 4175

interface Sample {
  t: number
  segment: 'active' | 'hidden'
  cpu: number
  heapMb: number
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const minutes = Number(args.minutes ?? 10)
  const interval = Number(args.interval ?? 30)
  const total = Math.max(1, Math.round((minutes * 60) / interval))
  const hiddenCount = Math.min(total - 1, Math.max(2, Math.round(total / 5)))
  const hiddenStart = Math.floor((total - hiddenCount) / 2)
  const hiddenEnd = hiddenStart + hiddenCount // exclusive interval index

  let server: ChildProcess | undefined
  try {
    server = startPreview(PORT)
    const base = `http://localhost:${PORT}/raccoon-village/`
    await waitForUrl(base)
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
      await page.goto(`${base}w/?speed=1&seed=1`)
      await page.waitForFunction(
        () => (window as unknown as { __rv?: { ready?: boolean } }).__rv?.ready === true,
      )
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Performance.enable')
      const read = async (): Promise<{ task: number; heap: number }> => {
        const { metrics } = await cdp.send('Performance.getMetrics')
        const get = (n: string): number => metrics.find((m) => m.name === n)?.value ?? 0
        return { task: get('TaskDuration'), heap: get('JSHeapUsedSize') }
      }
      const HIDE_JS = `(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'hidden'; } });
        document.dispatchEvent(new Event('visibilitychange'));
      })()`
      const SHOW_JS = `(() => {
        delete document.hidden;
        delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      })()`
      // Plain strings: avoids tsx helper injection (__name) inside the page context.
      const setHidden = async (hidden: boolean): Promise<void> => {
        await page.evaluate(hidden ? HIDE_JS : SHOW_JS)
      }

      await sleep(3000)
      let prev = await read()
      const startedAt = new Date()
      const samples: Sample[] = []
      for (let i = 0; i < total; i++) {
        const hidden = i >= hiddenStart && i < hiddenEnd
        if (i === hiddenStart) await setHidden(true)
        if (i === hiddenEnd) await setHidden(false)
        await sleep(interval * 1000)
        const cur = await read()
        samples.push({
          t: (i + 1) * interval,
          segment: hidden ? 'hidden' : 'active',
          cpu: cur.task - prev.task,
          heapMb: cur.heap / 1048576,
        })
        prev = cur
      }
      const version = browser.version()
      const mean = (xs: number[]): number =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
      const activeMean = mean(samples.filter((s) => s.segment === 'active').map((s) => s.cpu))
      const hiddenMean = mean(samples.filter((s) => s.segment === 'hidden').map((s) => s.cpu))
      const ratio = activeMean > 0 ? hiddenMean / activeMean : NaN
      const pass = ratio < 0.1
      const summary = [
        `active mean: ${activeMean.toFixed(3)} cpu_s/${interval}s`,
        `hidden mean: ${hiddenMean.toFixed(3)} cpu_s/${interval}s`,
        `ratio hidden/active: ${(ratio * 100).toFixed(1)}%`,
        `threshold (hidden < 10% of active): ${pass ? 'PASS' : 'FAIL'}`,
      ]
      const md = [
        '# M1 월페이퍼 전력 측정',
        '',
        `- 실행 시각: ${startedAt.toISOString()}`,
        `- Chromium: ${version}`,
        `- 파라미터: minutes=${minutes}, interval=${interval}s, samples=${total}, hidden samples=${hiddenCount} (index ${hiddenStart}..${hiddenEnd - 1}), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1`,
        '',
        '| time(s) | segment | cpu_s_per_' + interval + 's | heap_mb |',
        '| ---: | --- | ---: | ---: |',
        ...samples.map(
          (s) => `| ${s.t} | ${s.segment} | ${s.cpu.toFixed(3)} | ${s.heapMb.toFixed(1)} |`,
        ),
        '',
        '## 요약',
        '',
        ...summary.map((l) => `- ${l}`),
        '',
      ].join('\n')
      mkdirSync('docs/metrics', { recursive: true })
      writeFileSync('docs/metrics/M1.md', md)
      console.log(summary.join('\n'))
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
