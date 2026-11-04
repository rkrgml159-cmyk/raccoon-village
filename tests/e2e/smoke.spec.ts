import { test, expect } from '@playwright/test'

const STILL = '?at=2026-01-15T22:00&seed=1&still=1&n=12'

for (const path of ['', 'w/']) {
  test(`${path || 'play'} loads without console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`/raccoon-village/${path}${STILL}`)
    await page.waitForFunction(() => window.__rv?.ready)
    expect(errors).toEqual([])
    await expect(page.locator('canvas')).toBeVisible()
    expect(await page.evaluate(() => window.__rv?.ctx.skyKey)).toBe('winter-night')
    await expect(page).toHaveScreenshot(`${path ? 'wallpaper' : 'play'}.png`)
  })
}

test('wallpaper sound button starts audio', async ({ page }) => {
  await page.goto('/raccoon-village/w/' + STILL)
  await page.waitForFunction(() => window.__rv?.ready)
  await page.getByRole('button').click()
  await expect.poll(() => page.evaluate(() => window.__rv?.audio)).toMatch(/running|unavailable/)
  await expect(page.getByRole('button')).toHaveCount(0)
})

test('resident changes state over real time', async ({ page }) => {
  await page.goto('/raccoon-village/?at=2026-04-10T12:00&seed=5')
  await page.waitForFunction(() => window.__rv?.ready)
  const s0 = await page.evaluate(() => window.__rv?.residents.map((r) => r.state) ?? [])
  await page.waitForFunction(
    (initial) => window.__rv?.residents.some((r, i) => r.state !== initial[i]),
    s0,
    { timeout: 40000 },
  )
})

test('showcase shows all species', async ({ page, isMobile }) => {
  test.skip(isMobile || page.viewportSize()?.width === 390, 'desktop only')
  await page.goto('/raccoon-village/?species=all&at=2026-04-10T12:00&seed=1')
  await page.waitForFunction(() => window.__rv?.ready)
  expect(await page.evaluate(() => window.__rv?.residents.length)).toBe(25)
  await expect(page).toHaveScreenshot('showcase.png')
})

test('tap shows a thought bubble in play mode', async ({ page }) => {
  await page.goto('/raccoon-village/?at=2026-04-10T12:00&seed=5&n=12')
  await page.waitForFunction(() => window.__rv?.ready)
  const p = await page.evaluate(() => window.__rv?.positions[0] ?? { x: 0, y: 0 })
  // positions are feet; click a little above so the click lands on the sprite body
  await page.mouse.click(p.x, p.y - 10)
  await expect
    .poll(() => page.evaluate(() => window.__rv?.bubbles.some((b) => b.kind === 'thought')))
    .toBe(true)
})

test('wallpaper ignores taps', async ({ page }) => {
  await page.goto('/raccoon-village/w/?at=2026-04-10T12:00&seed=5&n=12')
  await page.waitForFunction(() => window.__rv?.ready)
  const p = await page.evaluate(() => window.__rv?.positions[0] ?? { x: 0, y: 0 })
  await page.mouse.click(p.x, p.y - 10)
  await page.waitForTimeout(1000)
  expect(await page.evaluate(() => window.__rv?.bubbles.length)).toBe(0)
})

test('a duet happens within 120 s at speed 60', async ({ page, isMobile }) => {
  test.skip(isMobile || page.viewportSize()?.width === 390, 'desktop only')
  test.setTimeout(150_000)
  await page.goto('/raccoon-village/?speed=60&seed=7&n=12&at=2026-04-10T12:00')
  await page.waitForFunction(
    () => (window.__rv?.duets.length ?? 0) >= 1 || (window.__rv?.duetLog.length ?? 0) >= 1,
    null,
    { timeout: 120_000 },
  )
})
