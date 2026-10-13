/**
 * Screenshot every major screen, for eyeballing the visual design.
 *
 *   node scripts/ui-shots.mjs [outDir]
 *
 * Not a test — it asserts nothing. It exists so a restyle can be reviewed as
 * pictures rather than as a diff.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'

// A trailing slash is stripped so `${BASE}/orders` never becomes `//orders`,
// and the root visit below re-adds it — `vite preview` serves the built bundle
// under the /admin/ base and answers a bare /admin with a hint page, not the app.
const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const OUT = process.argv[2] ?? '/tmp/shots'

const SCREENS = [
  ['products', '/products'],
  ['product-form', '/products/new'],
  ['categories', '/categories'],
  ['collections', '/collections'],
  ['collection-form', '/collections/new'],
  ['discounts', '/discounts'],
  ['discount-form', '/discounts/new'],
  ['media', '/media'],
  ['staff', '/settings/staff'],
  ['staff-form', '/settings/staff/new'],
  ['roles', '/settings/roles'],
  ['navigation', '/settings/navigation'],
]

const run = async () => {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/login.png` })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1500)

  for (const [name, path] of SCREENS) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`  ${name}`)
  }

  await browser.close()
  console.log(`\nwrote ${SCREENS.length + 1} shots to ${OUT}\n`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
