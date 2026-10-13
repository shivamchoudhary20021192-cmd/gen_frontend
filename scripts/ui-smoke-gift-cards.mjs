/**
 * Browser smoke test for Products → Gift cards, as staff use it: issue a card
 * (the code shown once), find it by its last four characters, open it, adjust
 * its balance with a reason, disable and re-enable it; and the product form's
 * "this product is a gift card" switch.
 *
 *   ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 BACKEND_DIR=D:/veylog-backend \
 *   PW_CHANNEL=chrome SHOTS_DIR=… node scripts/ui-smoke-gift-cards.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const BASE = process.env.ADMIN_URL ?? 'http://localhost:5176'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4100'
const SHOTS = process.env.SHOTS_DIR ?? 'screenshots'
const BACKEND = path.resolve(process.env.BACKEND_DIR ?? '../veylog-backend')
createRequire(path.join(BACKEND, 'package.json'))('dotenv').config({ path: path.join(BACKEND, '.env') })
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'

let passed = 0
const failures = []
function ok(label, condition, detail) {
  if (condition) {
    passed += 1
    process.stdout.write(`  ✓ ${label}\n`)
  } else {
    failures.push(label)
    process.stdout.write(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 300)}`}\n`)
  }
}
const visible = (locator, timeout = 15000) => locator.waitFor({ timeout }).then(() => true, () => false)

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const response = await fetch(`${API}/admin/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  const tokens = await response.json()
  const access = tokens.access_token ?? tokens.tokens?.access_token
  const refresh = tokens.refresh_token ?? tokens.tokens?.refresh_token
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await context.addInitScript(([a, r]) => {
    localStorage.setItem('veylog.access_token', a)
    localStorage.setItem('veylog.refresh_token', r)
  }, [access, refresh])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))

  try {
    process.stdout.write('\nIssuing\n')
    await page.goto(`${BASE}/gift-cards`, { waitUntil: 'load', timeout: 90000 })
    ok('the page lists gift cards with what is outstanding', await visible(page.getByText(/issued · .* outstanding/), 60000))
    ok('the sidebar links to it under Products', await visible(page.getByRole('link', { name: 'Gift cards' })))
    await page.getByRole('button', { name: 'Issue gift card' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Initial value').fill('750')
    await dialog.getByLabel('Internal note').fill('UI smoke')
    await dialog.getByRole('button', { name: 'Issue gift card' }).click()
    ok('shows the code once, after issuing', await visible(dialog.getByText('Gift card issued')))
    const code = (await dialog.locator('div').filter({ hasText: /^[A-Z0-9]{4}( [A-Z0-9]{4}){3}$/ }).first().textContent())?.trim() ?? ''
    ok('a 16-character code in groups of four', /^[A-Z0-9]{4}( [A-Z0-9]{4}){3}$/.test(code), code)
    await page.screenshot({ path: `${SHOTS}/gift-cards-1-issued.png` })
    await dialog.getByRole('button', { name: 'Done' }).click()

    process.stdout.write('\nFinding and managing it\n')
    const last = code.slice(-4)
    await page.getByPlaceholder('Last 4 characters, customer, order').fill(last)
    const row = page.getByRole('row').filter({ hasText: `•••• •••• •••• ${last}` })
    ok('staff find it by its last four characters', await visible(row))
    ok('and never see the code in the list', !(await page.getByText(code.replace(/ /g, '')).count()))
    await row.click()
    const drawer = page.locator('.MuiDrawer-paper')
    ok('opens with its balance and history', await visible(drawer.getByText('History', { exact: true })))
    await drawer.getByRole('button', { name: 'Adjust balance' }).click()
    const adjust = page.getByRole('dialog', { name: 'Adjust balance' })
    await adjust.getByLabel('Amount').fill('250')
    await adjust.getByLabel('Reason').fill('Goodwill for a late delivery')
    await adjust.getByRole('button', { name: 'Save' }).click()
    ok('adjusts the balance with a reason', await visible(drawer.getByText(/^₹1,000(\.00)?$/).first()))
    ok('and the history says why', await visible(drawer.getByText('Goodwill for a late delivery')))
    await drawer.getByRole('button', { name: 'Disable' }).click()
    ok('can be disabled', await visible(drawer.getByText('Disabled', { exact: true }).first()))
    await drawer.getByRole('button', { name: 'Re-enable' }).click()
    ok('and re-enabled', await visible(drawer.getByRole('button', { name: 'Disable' })))
    await page.screenshot({ path: `${SHOTS}/gift-cards-2-drawer.png` })
    await page.keyboard.press('Escape')

    process.stdout.write('\nSelling them\n')
    await page.goto(`${BASE}/products/18`, { waitUntil: 'load', timeout: 90000 })
    const toggle = page.getByLabel('This product is a gift card')
    ok('the product form offers the gift card switch', await visible(toggle, 60000))
    await toggle.check()
    ok('and explains what it means', await visible(page.getByText(/a gift card worth the price paid is issued/)))
    await page.screenshot({ path: `${SHOTS}/gift-cards-3-product.png` })
    await toggle.uncheck()

    ok('no page errors', errors.length === 0, errors)
  } catch (error) {
    failures.push(String(error))
    process.stdout.write(`  ✗ ${String(error).split('\n').slice(0, 10).join('\n    ')}\n`)
    await page.screenshot({ path: `${SHOTS}/gift-cards-failure.png` }).catch(() => undefined)
  } finally {
    await browser.close()
  }
  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
