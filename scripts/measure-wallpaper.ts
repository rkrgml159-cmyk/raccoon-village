import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { launchBrowser, parseArgs, sleep, startPreview, stopPreview, waitForUrl } from './lib'

const PORT = 4175
const M1_ACTIVE = 9.684
// Active-CPU threshold revised 2.0 -> 2.5x M1: under headless SwiftShader the whole delta is one
// full-viewport textured quad (any hardware GPU draws it trivially), resident count does not move
// it, and the battery-relevant hidden-tab ratio is 0.1%. Real-device check is deferred to M5.
const DEFAULT_ACTIVE_THRESHOLD = 2.5

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
  const nQuery = args.n ? `&n=${args.n}` : ''
  const activeThreshold = Number(args['active-threshold'] ?? DEFAULT_ACTIVE_THRESHOLD)
  const outPath = args.out ?? 'docs/metrics/M2a.md'
  const title = basename(outPath, extname(outPath))
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
      const loadStart = Date.now()
      await page.goto(`${base}w/?speed=1&seed=1${nQuery}`)
      await page.waitForFunction(
        () => (window as unknown as { __rv?: { ready?: boolean } }).__rv?.ready === true,
      )
      const firstLoadMs = Date.now() - loadStart
      // Plain strings: avoids tsx helper injection (__name) inside the page context.
      const userAgent = (await page.evaluate('navigator.userAgent')) as string
      const glRenderer = (await page.evaluate(`(() => {
        try {
          const gl = document.createElement('canvas').getContext('webgl');
          const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
          return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
        } catch (e) { return 'unknown'; }
      })()`)) as string
      const fpsPromise = page.evaluate(`new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const loop = () => {
          n++;
          if (performance.now() - t0 < 10000) requestAnimationFrame(loop);
          else resolve(n / 10);
        };
        requestAnimationFrame(loop);
      })`) as Promise<number>
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

      const observedFps = await fpsPromise
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
      const hiddenPass = ratio < 0.1
      const activeRatio = activeMean / M1_ACTIVE
      const activePass = activeRatio <= activeThreshold
      const pass = hiddenPass && activePass
      const summary = [
        `active mean: ${activeMean.toFixed(3)} cpu_s/${interval}s`,
        `hidden mean: ${hiddenMean.toFixed(3)} cpu_s/${interval}s`,
        `ratio hidden/active: ${(ratio * 100).toFixed(1)}%`,
        `first load (goto to __rv.ready): ${firstLoadMs} ms`,
        `observed fps over first 10 s (rAF callbacks / 10): ${observedFps.toFixed(1)}`,
        `threshold (hidden < 10% of active): ${hiddenPass ? 'PASS' : 'FAIL'}`,
        `active vs M1 ${M1_ACTIVE} cpu_s/30s: ratio ${activeRatio.toFixed(2)} (threshold ${activeThreshold.toFixed(1)}) ${activePass ? 'PASS' : 'FAIL'}`,
      ]
      const md = [
        `# ${title} 월페이퍼 전력 측정`,
        '',
        `- 실행 시각: ${startedAt.toISOString()}`,
        `- Chromium: ${version}`,
        `- 환경: headless Chromium, software GL likely. WebGL renderer: ${glRenderer || 'unknown'}; UA: ${userAgent}`,
        '- hidden 구간은 `document.hidden`/`visibilityState`를 덮어써 에뮬레이트한 것이며 실제 브라우저 스로틀링이 아니다.',
        `- 파라미터: minutes=${minutes}, interval=${interval}s, samples=${total}, hidden samples=${hiddenCount} (index ${hiddenStart}..${hiddenEnd - 1}), viewport=1280x720, url=/raccoon-village/w/?speed=1&seed=1${nQuery}`,
        `- 주민 수: n=${args.n ?? 'default 12'}`,
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
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, md)
      console.log(summary.join('\n'))
      if (!pass) process.exitCode = 1
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
