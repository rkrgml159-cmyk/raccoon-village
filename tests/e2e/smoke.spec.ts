import { test, expect } from '@playwright/test'

const STILL = '?at=2026-01-15T22:00&seed=1&still=1'

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

test('resident changes state over time with FastClock', async ({ page }) => {
  await page.goto('/raccoon-village/?at=2026-04-10T12:00&seed=5')
  await page.waitForFunction(() => window.__rv?.ready)
  const s0 = await page.evaluate(() => window.__rv?.resident.state)
  await page.waitForFunction((s) => window.__rv?.resident.state !== s, s0, {
    timeout: 40000,
  })
})
