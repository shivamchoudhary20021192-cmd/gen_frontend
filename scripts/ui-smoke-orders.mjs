/**
 * Headless click-through of the Orders and Customers screens.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-orders.mjs
 *
 * The point of this suite is that the lifecycle buttons are real. It seeds a
 * fresh order through the storefront API, then drives it confirm → pack → ship
 * → deliver *by clicking*, and after each step checks the transition the server
 * would refuse is genuinely not on screen. A detail page that renders every
 * button and lets the API say no is the failure this is looking for.
 *
 * It then refunds a delivered order and walks the customer screens, checking
 * that the phone number masked in the list is unmasked on the detail page.
 *
 * Console errors are a failure, not noise.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { pickSellable } from './lib/catalogue.mjs'

// A trailing slash is stripped so `${BASE}/orders` never becomes `//orders`,
// and the root visit below re-adds it — `vite preview` serves the built bundle
// under the /admin/ base and answers a bare /admin with a hint page, not the app.
const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const API = process.env.SHOP_API ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = 'screenshots'

let passed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  }
}

/**
 * Seeds an order the way a customer would make one, over the public API, so the
 * screens are exercised against a row the storefront actually produced rather
 * than one hand-written into the table.
 */
async function seedOrder(phone) {
  const post = async (path, body, headers = {}) => {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body ?? {}),
    })
    if (!response.ok) throw new Error(`${path} → ${response.status} ${await response.text()}`)
    return response.json()
  }

  const { product: detailProduct, variant } = await pickSellable(API, 2)
  const detail = { product: detailProduct }

  const { cart } = await post('/api/v1/cart')
  await post(`/api/v1/cart/${cart.token}/items`, { variant_id: variant.id, quantity: 2 })

  const { order } = await post(
    `/api/v1/cart/${cart.token}/checkout`,
    {
      payment_method: 'cod',
      contact: { first_name: 'Smoke', last_name: 'Tester', phone, email: `smoke.${phone}@example.com` },
      shipping_address: {
        line1: '4 Residency Road',
        line2: 'Shanthala Nagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560025',
      },
    },
    { 'Idempotency-Key': crypto.randomUUID() },
  )
  return order
}

const signIn = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
}

/** Clicks an action button and waits for the detail page to settle. */
const act = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).click()
  await page.waitForTimeout(1200)
}

const run = async () => {
  mkdirSync(SHOTS, { recursive: true })

  // A phone the customer screens can find again, unique per run.
  const phone = `9${String(Date.now()).slice(-9)}`
  const order = await seedOrder(phone)
  console.log(`\nVeylog admin UI — orders and customers\n\nSeeded ${order.order_number} for ${phone}\n`)

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(
    existsSync(executablePath)
      ? { executablePath, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] }
      : {},
  )
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

  // The sidebar carries menu labels that collide with page content — there is a
  // "Returns & refunds" nav item and a Refund button, a "Shipments" nav item and
  // a Shipments card. Assertions about the page are scoped to the content
  // region so the test cannot pass (or fail) on the navigation.
  const main = page.locator('main')

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await signIn(page)

  // ── the sidebar ────────────────────────────────────────────────────────────
  console.log('Sidebar')
  await page.waitForTimeout(1500)
  // Both are routed rows, so they are anchors — a routed group navigates and
  // opens rather than only toggling. Match on the tail because the accessible
  // name carries the badge ("99+ Orders").
  const ordersNav = page.getByRole('navigation').getByRole('link', { name: /Orders$/ }).first()
  ok('Orders is no longer greyed out', await ordersNav.isEnabled())
  // The parents specifically, not a count of every "Soon" in the sidebar —
  // most of the menu genuinely is unbuilt and should still say so.
  const ordersLabel = await ordersNav.innerText()
  const customersLabel = await page
    .getByRole('navigation')
    .getByRole('link', { name: /Customers$/ })
    .first()
    .innerText()
  ok('Orders lost its "Soon" chip', !ordersLabel.includes('Soon'), ordersLabel)
  ok('Customers lost its "Soon" chip', !customersLabel.includes('Soon'), customersLabel)

  // ── list ───────────────────────────────────────────────────────────────────
  console.log('\nOrders list')
  // Searched for rather than assumed to be on the first page. Other suites place
  // orders too, and "it is the newest, so it is visible" stops being true the
  // moment two of them run close together.
  await page.goto(`${BASE}/orders?q=${order.order_number}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  ok('the seeded order is in the table', (await page.getByText(order.order_number).count()) >= 1)

  await page.screenshot({ path: `${SHOTS}/orders-list.png`, fullPage: true })

  // Tabs are a filter, not decoration.
  await page.getByRole('tab', { name: /^Pending/ }).click()
  await page.waitForTimeout(1200)
  ok('the Pending tab filters the URL', page.url().includes('status=pending'))
  const pendingNumbers = await page.locator('table tbody tr').allInnerTexts()
  ok(
    'every row in Pending is actually pending',
    pendingNumbers.every((row) => row.includes('Pending')),
    pendingNumbers.slice(0, 2),
  )

  // ── detail and the lifecycle ───────────────────────────────────────────────
  console.log('\nLifecycle')
  await page.getByText(order.order_number).first().click()
  await page.waitForURL('**/orders/*', { timeout: 10000 })
  await page.waitForTimeout(1200)

  ok('the detail page opens on the right order', (await page.locator('h5').first().innerText()).includes(order.order_number))
  ok('the delivery address is shown', (await main.getByText('Residency Road').count()) >= 1)
  // Compared against what the storefront actually charged, not a number typed
  // into this file — the admin must not restate the total differently.
  const expectedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(order.total)
  ok(
    'the admin total matches what the storefront charged',
    (await main.getByText(expectedTotal, { exact: false }).count()) >= 1,
    expectedTotal,
  )

  // A pending order can be confirmed or cancelled, and nothing else. If "Ship"
  // is on screen here the buttons are hardcoded rather than server-driven.
  ok('Ship is not offered on a pending order', (await main.getByRole('button', { name: 'Ship', exact: true }).count()) === 0)
  ok('Mark delivered is not offered on a pending order', (await main.getByRole('button', { name: 'Mark delivered' }).count()) === 0)

  await page.screenshot({ path: `${SHOTS}/order-detail.png`, fullPage: true })

  await act(page, 'Confirm')
  ok('confirming moved the order on', (await main.getByText('Confirmed', { exact: true }).count()) >= 1)

  await act(page, 'Mark packed')
  ok('Ship appears once the order is packed', (await main.getByRole('button', { name: 'Ship', exact: true }).count()) === 1)

  // Ship opens a dialog rather than firing straight away — courier details are
  // needed and the customer is told about them.
  await main.getByRole('button', { name: 'Ship', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByLabel('AWB number').fill('SMOKE123456789')
  await page.getByLabel('Tracking URL').fill('https://track.example.com/SMOKE123456789')
  await page.getByRole('button', { name: 'Mark as shipped' }).click()
  await page.waitForTimeout(1800)
  ok('the AWB is recorded on the order', (await main.getByText('SMOKE123456789').count()) >= 1)
  ok('a shipment card appeared', (await main.getByText('Shipments', { exact: true }).count()) === 1)

  await act(page, 'Mark delivered')
  ok('the order reads as delivered', (await main.getByText('Delivered', { exact: true }).count()) >= 1)
  // COD money is collected on delivery — the payment status has to follow.
  ok('COD was collected on delivery', (await main.getByText('COD collected').count()) >= 1)

  const timelineEntries = await main.locator('text=/→/').count()
  ok('the timeline recorded every step', timelineEntries >= 4, timelineEntries)
  // Shipping changes the order status as well as the fulfilment status, and
  // both belong on the timeline — "when did this ship?" is the question this
  // screen exists to answer.
  ok('shipping is on the timeline as a status change', (await main.getByText('Packed → Shipped').count()) >= 1)

  await page.screenshot({ path: `${SHOTS}/order-delivered.png`, fullPage: true })

  // ── refund ─────────────────────────────────────────────────────────────────
  console.log('\nRefund')
  ok(
    'Refund is offered once money has been collected',
    (await main.getByRole('button', { name: 'Refund', exact: true }).count()) === 1,
  )
  await main.getByRole('button', { name: 'Refund', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByLabel('Amount').fill('200')
  await page.getByLabel('Reason').fill('Smoke test partial refund')
  await page.getByRole('button', { name: 'Issue refund' }).click()
  await page.waitForTimeout(1800)
  ok('the refund shows on the order', (await main.getByText('−₹200').count()) >= 1)
  ok('the order reads as partly refunded', (await main.getByText('Partly refunded').count()) >= 1)

  // ── customers ──────────────────────────────────────────────────────────────
  console.log('\nCustomers')
  await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.getByPlaceholder('Search name, phone or email').fill(phone.slice(-4))
  await page.waitForTimeout(1800)

  const listRows = await page.locator('table tbody tr').count()
  ok('the customer created by checkout is findable', listRows >= 1, listRows)

  const listedPhone = await page.locator('table tbody tr').first().innerText()
  ok('phone numbers are masked in the list', listedPhone.includes('•'), listedPhone.slice(0, 60))

  await page.screenshot({ path: `${SHOTS}/customers-list.png`, fullPage: true })

  await page.locator('table tbody tr').first().click()
  await page.waitForURL('**/customers/*', { timeout: 10000 })
  await page.waitForTimeout(1500)

  const detailText = await page.locator('body').innerText()
  ok('the detail page shows the number in full', detailText.includes(phone), phone)
  ok('the order history links back to the order', (await main.getByText(order.order_number).count()) >= 1)
  ok('lifetime spend is shown', (await main.getByText('Lifetime spend').count()) === 1)

  await page.screenshot({ path: `${SHOTS}/customer-detail.png`, fullPage: true })

  // An internal note is the one write on this screen an operator uses daily.
  await page.getByPlaceholder('Only staff can see this').fill('Called about the partial refund — happy.')
  await page.getByRole('button', { name: 'Add note' }).click()
  await page.waitForTimeout(1500)
  ok('the note was saved', (await main.getByText('Called about the partial refund').count()) >= 1)

  // ── console ────────────────────────────────────────────────────────────────
  console.log('\nConsole')
  const real = consoleErrors.filter((text) => !/favicon|React DevTools|Download the/i.test(text))
  ok('no console errors anywhere in the journey', real.length === 0, real.slice(0, 4))

  await browser.close()

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.log(failures.map((label) => `  - ${label}`).join('\n'))
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error.stack)
  process.exitCode = 1
})
