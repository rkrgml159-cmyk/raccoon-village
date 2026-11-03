import { spawn, type ChildProcess } from 'node:child_process'
import { chromium, type Browser } from '@playwright/test'

export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) out[m[1]] = m[2]
  }
  return out
}

export function startPreview(port: number): ChildProcess {
  return spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
}

export function stopPreview(proc: ChildProcess | undefined): void {
  if (!proc?.pid) return
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill('SIGTERM')
  }
}

export async function waitForUrl(url: string, timeoutMs = 30000): Promise<void> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timeout waiting for ${url}`)
}

export function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PW_CHROMIUM || undefined
  return chromium.launch({ executablePath })
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
