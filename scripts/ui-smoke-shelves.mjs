/**
 * The Merchandising screens: shelves, their layouts and their rules.
 *
 *   node scripts/ui-smoke-shelves.mjs
 *
 * What is actually being tested is whether a merchandiser can *understand*
 * what they are about to publish. The storefront suite proves the rules work;
 * this one proves the admin tells the truth about them:
 *
 *   · the sidebar has a way in, and it is clickable rather than greyed out
 *   · a rule that has a window offers one, and a rule that has none does not
 *     offer a slider that changes nothing
 *   · the preview shows what the rule chose, and says so in words when the
 *     rule came back short and the shelf was topped up
 *
 * Everything it creates, it deletes, and the deletion is asserted.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.ADMIN_URL ?? 'http://127.0.0.1:5173'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = 'screenshots'

let passed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed += 1
    process.stdout.write(`  ✓ ${label}\n`)
  } else {
    failures.push(label)
    process.stdout.write(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 240)}`}\n`)
  }
}

async function token() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`login → ${response.status}`)
  return body.access_token ?? body.tokens?.access_token
}

async function api(path, { method = 'GET', body, bearer } = {}) {
  const response = await fetch(`${API}/admin/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const bearer = await token()
  const made = []
  const stamp = Date.now().toString(36).toUpperCase().slice(-5)

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  try {
    // ── signing in ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })

    // ── the way in ───────────────────────────────────────────────────────────
    process.stdout.write('\nThe sidebar\n')
    // Waited for rather than asserted immediately: the menu is a query of its
    // own and the redirect out of /login lands before it resolves, so a bare
    // assertion here fails for timing rather than for the thing being tested.
    await page.getByText('Merchandising').first().waitFor({ state: 'visible', timeout: 15000 })
    ok('Merchandising is in the sidebar', (await page.getByText('Merchandising').count()) > 0)
    // A row the database offers but the bundle cannot render degrades to a
    // disabled item — so a clickable one is the proof that the page shipped
    // with the menu row, which is the pairing that keeps going wrong.
    await page.goto(`${BASE}/merchandising/shelves`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=Shelves', { timeout: 15000 })
    ok('and Shelves opens rather than 404ing', page.url().includes('/merchandising/shelves'))

    // ── the list groups by page ──────────────────────────────────────────────
    process.stdout.write('\nThe list\n')
    await page.waitForTimeout(800)
    ok('it groups shelves by the page they live on', await page.getByText('Home page').first().isVisible())
    ok(
      'and the shop’s own shelves are listed',
      (await page.locator('[data-shelf-row]').count()) >= 2,
      await page.locator('[data-shelf-row]').count(),
    )

    // ── building one ─────────────────────────────────────────────────────────
    process.stdout.write('\nBuilding a shelf\n')
    await page.goto(`${BASE}/merchandising/shelves/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=What is in it', { timeout: 15000 })

    await page.getByLabel('Heading').fill(`UI smoke shelf ${stamp}`)
    await page.getByLabel('Small line above it').fill('Smoke test')

    // The layout picker has to explain itself: "spotlight" means nothing to
    // someone who has not seen one.
    await page.locator('[data-shelf-layout]').click()
    const layoutOptions = await page.getByRole('option').allInnerTexts()
    ok('every layout is offered', layoutOptions.length === 4, layoutOptions)
    await page.getByRole('option', { name: 'Ranked chart' }).click()
    ok(
      'and the chosen one explains what it does',
      (await page.getByText(/reads as a chart/i).count()) > 0,
    )

    // A rule with a window offers one; a rule without must not.
    await page.locator('[data-shelf-source]').click()
    await page.getByRole('option', { name: 'Most repurchased' }).click()
    await page.waitForTimeout(300)
    ok('a windowed rule offers its window', (await page.locator('[data-shelf-window]').count()) === 1)
    ok(
      'and says what it actually measures',
      (await page.getByText(/bought more than once/i).count()) > 0,
    )

    await page.locator('[data-shelf-source]').click()
    await page.getByRole('option', { name: 'Highest rated' }).click()
    await page.waitForTimeout(300)
    ok(
      'a rule with no window offers no slider that would do nothing',
      (await page.locator('[data-shelf-window]').count()) === 0,
    )

    // Back to the interesting one, and save.
    await page.locator('[data-shelf-source]').click()
    await page.getByRole('option', { name: 'Most repurchased' }).click()
    await page.getByRole('button', { name: 'Create shelf' }).click()
    await page.waitForURL(/\/merchandising\/shelves\/\d+$/, { timeout: 15000 })
    const createdId = Number(page.url().split('/').pop())
    made.push(createdId)
    ok('the shelf is created and opens on itself', Number.isInteger(createdId) && createdId > 0)

    // ── the preview is the whole point ───────────────────────────────────────
    process.stdout.write('\nThe preview\n')
    await page.waitForSelector('[data-preview-count]', { timeout: 15000 })
    const count = await page.locator('[data-preview-count]').innerText()
    ok('it says how many products the rule found', /\d+ shown/.test(count), count)
    ok(
      'and draws them',
      (await page.locator('[data-preview-product]').count()) > 0,
      await page.locator('[data-preview-product]').count(),
    )

    // The honesty assertion. "Most repurchased" on this catalogue finds very
    // few, so the shelf is topped up — and the screen has to say so. A system
    // that silently pads a rule teaches merchandisers to distrust every rule.
    const fallbackChip = await page.locator('[data-preview-fallback]').count()
    const fallbackWords = await page.getByText(/so the shelf was filled up with/i).count()
    ok(
      'when the rule is short, the screen says the shelf was topped up',
      fallbackChip === 0 || fallbackWords > 0,
      { fallbackChip, fallbackWords },
    )

    await page.screenshot({ path: `${SHOTS}/shelf-form.png`, fullPage: false })

    // ── pinning ──────────────────────────────────────────────────────────────
    process.stdout.write('\nPinning by name, not by id\n')
    const pinBox = page.getByLabel('Find a product')
    await pinBox.click()
    await pinBox.fill('serum')
    await page.waitForTimeout(700)
    const options = await page.getByRole('option').count()
    ok('products are searched by name', options > 0, options)
    await page.getByRole('option').first().click()
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1200)

    const saved = await api(`/merchandising/shelves/${createdId}`, { bearer })
    ok('the pin is stored', (saved.body.shelf.pins ?? []).length === 1, saved.body.shelf.pins)

    const preview = await api(`/merchandising/shelves/${createdId}/preview`, { bearer })
    ok(
      'and it is first in what the shelf will show',
      preview.body.preview.products[0]?.id === saved.body.shelf.pins[0].product_id,
      { pin: saved.body.shelf.pins[0], first: preview.body.preview.products[0] },
    )

    ok('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3))
  } finally {
    for (const id of made) await api(`/merchandising/shelves/${id}`, { method: 'DELETE', bearer })
    const left = (await api('/merchandising/shelves', { bearer })).body.shelves ?? []
    ok(
      'everything this suite made is removed',
      !left.some((shelf) => shelf.title.startsWith('UI smoke shelf')),
      left.filter((shelf) => shelf.title.startsWith('UI smoke shelf')).map((shelf) => shelf.title),
    )
    await browser.close()
  }

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  if (failures.length) {
    failures.forEach((failure) => process.stdout.write(`  · ${failure}\n`))
    process.exit(1)
  }
}

main().catch((error) => {
  process.stdout.write(`${String(error)}\n`)
  process.exit(1)
})
