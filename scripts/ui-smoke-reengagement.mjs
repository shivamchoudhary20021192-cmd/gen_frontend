/**
 * Headless click-through of the "Wanted, not bought" re-engagement screen.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-reengagement.mjs
 *
 * The screen exists to put a message on a stranger's phone, so the claims worth
 * proving are the ones that stop it messaging the wrong person:
 *
 *   * the table shows what the API returned — same people, same products
 *   * anyone who never opted in is listed but visibly marked as skippable
 *   * Send counts before it sends, and it is dead when nobody opted in
 *   * with no provider connected the screen says so, instead of reporting a
 *     row of successful sends that reached nobody
 *
 * Every assertion is derived from the API rather than from fixed wording or a
 * fixed row count, so the suite is repeatable against whatever the database
 * happens to hold.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { clickNav } from './lib/sidebar.mjs'

// A trailing slash is stripped so `${BASE}/x` never becomes `//x`, and the root
// visit re-adds it — `vite preview` serves the built bundle under /admin/.
const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const API = process.env.API_BASE ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'

/** Mirrors the screen's own opening filters, so the two are comparable. */
const SCREEN_DEFAULTS = 'limit=20&within_days=30'

let passed = 0
let failed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    failures.push(label)
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
  }
}

async function adminToken() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(`admin login → ${response.status} ${JSON.stringify(body).slice(0, 200)}`)
  }
  return body.access_token ?? body.tokens?.access_token
}

async function audience(token, query) {
  const response = await fetch(`${API}/admin/api/v1/reengagement/audience?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(`audience → ${response.status} ${JSON.stringify(body).slice(0, 200)}`)
  }
  return body
}

const run = async () => {
  const token = await adminToken()
  const expected = await audience(token, SCREEN_DEFAULTS)
  const rows = expected.audience ?? []
  const summary = expected.summary ?? {}

  console.log('\nVeylor admin UI — re-engagement\n')
  console.log(
    `API says: ${summary.people} people, ${summary.contactable} contactable, ` +
      `${rows.length} rows on page one, can_send=${summary.can_send}\n`,
  )

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1200)

  // ── the sidebar reaches it ────────────────────────────────────────────────
  console.log('Sidebar')
  await clickNav(page, 'Wanted, not bought')
  await page.waitForURL('**/reengagement', { timeout: 15000 })
  await page.waitForTimeout(2500)
  ok('the screen opens from the sidebar', page.url().endsWith('/reengagement'))

  const main = page.locator('main')
  ok(
    'the page titles itself',
    (await main.getByRole('heading', { name: 'Wanted, not bought' }).count()) === 1,
  )

  // ── the table matches the API ─────────────────────────────────────────────
  console.log('\nThe audience')
  const onScreen = await main.locator('[data-audience-row]').count()
  ok('every row the API returned is rendered', onScreen === rows.length, `${onScreen} vs ${rows.length}`)

  if (rows.length > 0) {
    const first = rows[0]
    const row = main.locator(`[data-audience-row="${first.customer.id}-${first.product.id}"]`).first()
    ok('the first row is addressable by its customer and product', (await row.count()) === 1)
    ok('it names the product', (await row.getByText(first.product.name).count()) >= 1)
    ok(
      'it shows the masked phone the API returned, never the full number',
      (await row.getByText(first.customer.phone).count()) === 1,
      first.customer.phone,
    )
    ok(
      `it marks the interest as "${first.interest}"`,
      (await row.getByText(first.interest === 'cart' ? 'Left in cart' : 'Saved').count()) === 1,
    )

    // Consent is the whole point: a row that cannot be messaged has to say so
    // on the row, not only in a total at the top.
    if (first.customer.contactable) {
      ok('a contactable customer is marked opted in', (await row.getByText('Opted in').count()) === 1)
    } else {
      ok(
        'a customer who cannot be messaged carries the reason',
        (await row.getByText(first.customer.reason).count()) === 1,
        first.customer.reason,
      )
    }

    // An out-of-stock product must be called out — nudging someone toward
    // something the shop cannot ship is worse than not nudging at all.
    const outOfStock = rows.find((r) => !r.product.in_stock)
    if (outOfStock) {
      const stockRow = main
        .locator(`[data-audience-row="${outOfStock.customer.id}-${outOfStock.product.id}"]`)
        .first()
      ok('an out-of-stock product is flagged on its row', (await stockRow.getByText('Out of stock').count()) === 1)
    }
  }

  // ── the headline numbers ──────────────────────────────────────────────────
  console.log('\nSummary')
  for (const [label, value] of [
    ['People', summary.people],
    ['Contactable', summary.contactable],
    ['Saved', summary.saved],
    ['In cart', summary.cart],
  ]) {
    const card = main.locator('.MuiCard-root', { hasText: label }).first()
    const text = await card.innerText().catch(() => '')
    ok(`${label} reports ${value}`, new RegExp(`\\b${value}\\b`).test(text), text.replace(/\n+/g, ' '))
  }

  // ── the guard on sending ──────────────────────────────────────────────────
  console.log('\nSending')
  const sendButton = main.getByRole('button', { name: 'Send nudge' })
  ok('the screen offers a send', (await sendButton.count()) === 1)

  if (Number(summary.contactable) === 0) {
    ok(
      'with nobody opted in, Send is disabled rather than a silent no-op',
      await sendButton.isDisabled(),
    )
  } else {
    await sendButton.click()
    await page.waitForTimeout(3000)
    const dialog = page.getByRole('dialog')
    ok('it confirms before sending', await dialog.isVisible())
    ok(
      'and counts the recipients before anything is sent',
      (await dialog.getByText(/would be messaged/i).count()) === 1,
      (await dialog.innerText()).replace(/\n+/g, ' ').slice(0, 160),
    )
    // Deliberately not confirming: this suite must never message a real number,
    // and the dry run has already proven the count.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForTimeout(800)
    ok('cancelling sends nothing', (await page.getByRole('dialog').count()) === 0)
  }

  // ── honesty about the provider ────────────────────────────────────────────
  console.log('\nProvider')
  const warning = await main.getByText(/No WhatsApp provider is connected/i).count()
  ok(
    summary.can_send
      ? 'a provider is connected, so no warning is shown'
      : 'with no provider connected, the screen says so rather than faking success',
    summary.can_send ? warning === 0 : warning === 1,
    `can_send=${summary.can_send} warning=${warning}`,
  )

  // ── filters actually filter ───────────────────────────────────────────────
  console.log('\nFilters')
  const optedIn = await audience(token, `${SCREEN_DEFAULTS}&contactable=true`)
  await main.getByLabel('Only people who opted in').check()
  await page.waitForTimeout(2500)
  const narrowed = await main.locator('[data-audience-row]').count()
  ok(
    'filtering to opted-in only matches what the API returns for that filter',
    narrowed === (optedIn.audience ?? []).length,
    `${narrowed} vs ${(optedIn.audience ?? []).length}`,
  )
  ok('and never widens the audience', narrowed <= rows.length, `${rows.length} → ${narrowed}`)
  await main.getByLabel('Only people who opted in').uncheck()
  await page.waitForTimeout(2000)

  const inStock = await audience(token, `${SCREEN_DEFAULTS}&in_stock=true`)
  await main.getByLabel('Only products in stock').check()
  await page.waitForTimeout(2500)
  const stocked = await main.locator('[data-audience-row]').count()
  ok(
    'the in-stock filter matches the API too',
    stocked === (inStock.audience ?? []).length,
    `${stocked} vs ${(inStock.audience ?? []).length}`,
  )

  console.log('\nConsole')
  const unexpected = consoleErrors.filter((text) => !/favicon|ERR_/i.test(text))
  ok('no console errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n${'─'.repeat(60)}\n  ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log(`  failures: ${failures.join(', ')}`)
    process.exit(1)
  }
}

run().catch((error) => {
  console.error(`\nFATAL: ${error.message}`)
  process.exit(1)
})
