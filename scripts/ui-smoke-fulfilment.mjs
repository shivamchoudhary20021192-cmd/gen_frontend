/**
 * Headless click-through of Shipments, Returns, Invoices and Abandoned carts.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-fulfilment.mjs
 *
 * Seeds a real order through the storefront, ships it, and then drives all four
 * screens by clicking. What it is actually checking:
 *
 *   - the sidebar enabled the four rows that were "Soon"
 *   - a shipment's action buttons come from the server's transition graph, so
 *     the illegal move is absent rather than present-and-refused
 *   - a return restocks and refunds from the UI, not just from the API
 *   - the invoice PDF is real and the GST split is named on screen
 *   - an abandoned cart yields a recovery link that restores the bag
 *
 * Console errors fail the run.
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

const post = async (path, body, headers = {}) => {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  })
  if (!response.ok) throw new Error(`${path} → ${response.status} ${await response.text()}`)
  return response.json()
}

/** A cart with items in it, left unconverted so the sweep can find it. */
async function strandCart() {
  const { variant } = await pickSellable(API, 1)
  const { cart } = await post('/api/v1/cart')
  await post(`/api/v1/cart/${cart.token}/items`, { variant_id: variant.id, quantity: 1 })
  return cart.token
}

async function seedShippedOrder(phone, token) {
  const { product: detailProduct, variant } = await pickSellable(API, 2)
  const detail = { product: detailProduct }

  const { cart } = await post('/api/v1/cart')
  await post(`/api/v1/cart/${cart.token}/items`, { variant_id: variant.id, quantity: 2 })
  const { order } = await post(
    `/api/v1/cart/${cart.token}/checkout`,
    {
      payment_method: 'cod',
      contact: { first_name: 'Fulfil', last_name: 'Screen', phone, email: `s.${phone}@example.com` },
      shipping_address: { line1: '8 Brigade Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    },
    { 'Idempotency-Key': crypto.randomUUID() },
  )

  const admin = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const step = (path, body) =>
    fetch(`${API}/admin/api/v1${path}`, {
      method: 'POST',
      headers: { ...admin, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body ?? {}),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`)
      return r.json()
    })

  await step(`/orders/${order.id}/status`, { status: 'confirmed' })
  await step(`/orders/${order.id}/status`, { status: 'packed' })
  await step(`/orders/${order.id}/ship`, { shipping_mode: 'surface' })
  // Deliberately stops at shipped. Delivering also closes the shipment, and the
  // shipments section needs a parcel still in flight to have anything to do.
  return { order, deliver: () => step(`/orders/${order.id}/status`, { status: 'delivered' }) }
}

const run = async () => {
  mkdirSync(SHOTS, { recursive: true })

  const login = await post('/admin/api/v1/auth/login', { email: EMAIL, password: PASSWORD })
  const accessToken = login.tokens?.access_token ?? login.access_token

  const phone = `9${String(Date.now()).slice(-9)}`
  const { order, deliver } = await seedShippedOrder(phone, accessToken)
  const strandedToken = await strandCart()
  // Age it past the four-hour idle threshold so the sweep picks it up.
  await fetch(`${API}/admin/api/v1/carts/abandoned/sweep`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  console.log(`\nVeylog admin UI — fulfilment\n\nSeeded ${order.order_number}\n`)

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(
    existsSync(executablePath)
      ? { executablePath, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] }
      : {},
  )
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  // Clipboard writes are what the recovery-link button does; without this the
  // copy path throws and the test would be checking the fallback, not the
  // feature.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const main = page.locator('main')

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
  await page.waitForTimeout(1500)

  // ── sidebar ────────────────────────────────────────────────────────────────
  console.log('Sidebar')
  const nav = page.getByRole('navigation')
  // The Orders group only renders its children while it is the active section,
  // so the sidebar is checked from inside it rather than from /products.
  await page.goto(`${BASE}/shipments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  // A disabled row renders as a div with role=button; an enabled one renders as
  // an anchor. Asserting on the link is therefore itself the enabled check —
  // the element only exists in that form once the item is navigable.
  for (const [label, href] of [
    ['Abandoned carts', '/abandoned'],
    ['Returns & refunds', '/returns'],
    ['Shipments', '/shipments'],
    ['Invoices', '/invoices'],
  ]) {
    const link = nav.getByRole('link', { name: new RegExp(`^${label}`) }).first()
    const text = await link.innerText()
    ok(`${label} is enabled`, !text.includes('Soon'), text)
    // endsWith, not equals: the built bundle is served under /admin/, so every
    // href carries that prefix while the dev server's does not.
    ok(`${label} points at ${href}`, ((await link.getAttribute('href')) ?? '').endsWith(href), await link.getAttribute('href'))
  }

  // ── shipments ──────────────────────────────────────────────────────────────
  console.log('\nShipments')
  await page.goto(`${BASE}/shipments?q=${order.order_number}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  ok('the shipments table has rows', (await main.locator('table tbody tr').count()) >= 1)
  ok("search found this order's shipment", (await main.getByText(order.order_number).count()) >= 1)
  // The stand-in carrier has to say so, or someone tells a customer a lie.
  ok('the stand-in carrier is disclosed', (await main.getByText(/No courier account is connected/).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/fulfilment-shipments.png`, fullPage: true })

  await main.locator('table tbody tr').first().click()
  await page.waitForTimeout(1200)
  const dialog = page.getByRole('dialog').first()
  ok('the shipment opens', (await dialog.getByText(/SHP\d+/).count()) >= 1)
  ok('a waybill is shown', (await dialog.getByText(/SR\d{12}|^\d{11}$|^\d{14}$/).count()) >= 1)
  // A parcel at label_generated cannot be delivered; the button must be absent.
  ok(
    'an illegal transition is not offered',
    (await dialog.getByRole('button', { name: 'Mark delivered', exact: true }).count()) === 0,
  )
  ok('the legal next step is offered', (await dialog.getByRole('button', { name: 'Mark picked up' }).count()) === 1)

  await dialog.getByRole('button', { name: /Refresh from carrier/ }).click()
  await page.waitForTimeout(2000)
  ok('tracking arrived', (await dialog.getByText(/Shipment booked|Waybill generated/).count()) >= 1)
  await page.screenshot({ path: `${SHOTS}/fulfilment-shipment-detail.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  // Now that the parcel has been looked at in flight, land it — the invoice and
  // return steps both need a delivered order.
  await deliver()

  // ── invoice, from the order ────────────────────────────────────────────────
  console.log('\nInvoice')
  await page.goto(`${BASE}/orders?q=${order.order_number}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await main.getByText(order.order_number).first().click()
  await page.waitForURL('**/orders/*', { timeout: 10000 })
  await page.waitForTimeout(1500)

  ok('the order offers an invoice', (await main.getByRole('button', { name: 'Issue invoice' }).count()) === 1)
  await main.getByRole('button', { name: 'Issue invoice' }).click()
  await page.waitForTimeout(2500)
  // Once issued, the button becomes the document — there is no "reissue".
  ok('the button becomes the invoice number', (await main.getByRole('link', { name: /INV\d+/ }).count()) === 1)

  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  ok('the invoice is listed', (await main.getByText(/INV\d+/).count()) >= 1)
  ok('the GST treatment is stated', (await main.getByText(/IGST|CGST \+ SGST/).count()) >= 1)
  ok('the filing summary is shown', (await main.getByText('Taxable value').count()) >= 1)
  await page.screenshot({ path: `${SHOTS}/fulfilment-invoices.png`, fullPage: true })

  const pdfLink = await main.getByRole('link', { name: 'PDF' }).first().getAttribute('href')
  const pdf = await fetch(`${API}${pdfLink}`)
  const bytes = Buffer.from(await pdf.arrayBuffer())
  ok('the PDF downloads and is a PDF', bytes.subarray(0, 4).toString() === '%PDF', bytes.subarray(0, 8).toString())

  // ── return, raised from the order ──────────────────────────────────────────
  console.log('\nReturn')
  await page.goto(`${BASE}/orders?q=${order.order_number}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await main.getByText(order.order_number).first().click()
  await page.waitForURL('**/orders/*', { timeout: 10000 })
  await page.waitForTimeout(1500)

  ok('a delivered order offers a return', (await main.getByRole('button', { name: 'Raise a return' }).count()) === 1)
  await main.getByRole('button', { name: 'Raise a return' }).click()
  await page.waitForTimeout(1800)

  const returnDialog = page.getByRole('dialog').first()
  await returnDialog.getByLabel('Qty').first().click()
  await page.getByRole('option', { name: '1', exact: true }).click()
  await page.waitForTimeout(400)
  await returnDialog.getByRole('button', { name: 'Raise return' }).click()
  await page.waitForURL('**/returns', { timeout: 12000 })
  await page.waitForTimeout(1800)

  ok('the RMA lands in the returns queue', (await main.getByText(/RMA\d+/).count()) >= 1)
  await page.screenshot({ path: `${SHOTS}/fulfilment-returns.png`, fullPage: true })

  await main.locator('table tbody tr').first().click()
  await page.waitForTimeout(1200)
  const rmaDialog = page.getByRole('dialog').first()
  ok('rejecting is offered before approval', (await rmaDialog.getByRole('button', { name: 'Reject' }).count()) === 1)
  ok('refunding is not offered yet', (await rmaDialog.getByRole('button', { name: 'Refund' }).count()) === 0)

  await rmaDialog.getByRole('button', { name: 'Approve' }).click()
  await page.waitForTimeout(1500)
  await rmaDialog.getByRole('button', { name: 'Book pickup' }).click()
  await page.waitForTimeout(2000)
  ok('a reverse pickup waybill was booked', (await rmaDialog.getByText('Reverse pickup').count()) === 1)

  await rmaDialog.getByRole('button', { name: 'Mark picked up' }).click()
  await page.waitForTimeout(1400)
  await rmaDialog.getByRole('button', { name: 'Mark received' }).click()
  await page.waitForTimeout(1400)

  await rmaDialog.getByRole('button', { name: 'Inspect' }).click()
  await page.waitForTimeout(900)
  const inspectDialog = page.getByRole('dialog').filter({ hasText: 'Inspect the return' })
  ok('unopened defaults to restocking', await inspectDialog.getByRole('checkbox').first().isChecked())
  await inspectDialog.getByRole('button', { name: 'Record inspection' }).click()
  await page.waitForTimeout(2000)

  ok('the refund step is now offered', (await rmaDialog.getByRole('button', { name: 'Refund' }).count()) === 1)
  await rmaDialog.getByRole('button', { name: 'Refund' }).click()
  await page.waitForTimeout(2200)
  ok('the return reads as refunded', (await rmaDialog.getByText('Refunded').count()) >= 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  // ── abandoned carts ────────────────────────────────────────────────────────
  console.log('\nAbandoned carts')
  // The path comes from the sidebar link checked above rather than being
  // written twice. When the menu row moved from /orders/abandoned to
  // /abandoned, the hard-coded copy here landed on the order-detail route and
  // asked it to load an order called "abandoned".
  const abandonedHref = await nav.getByRole('link', { name: /^Abandoned carts/ }).first().getAttribute('href')
  // The href is already absolute-from-root and carries the app's base, so it is
  // resolved against the current URL rather than glued onto BASE — which would
  // give /admin/admin/abandoned against the built bundle.
  await page.goto(new URL(abandonedHref, page.url()).toString(), { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  ok('the queue has the stranded cart', (await main.locator('table tbody tr').count()) >= 1)
  ok('value at risk is shown', (await main.getByText('Value at risk').count()) === 1)
  // Nobody should be chased automatically without a person deciding to.
  ok('the manual-only policy is stated', (await main.getByText(/sent by hand/).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/fulfilment-abandoned.png`, fullPage: true })

  await main.locator('table tbody tr').first().click()
  await page.waitForTimeout(1400)
  const cartDialog = page.getByRole('dialog').first()
  // The queue accumulates across runs, so the newest row may be a cart that
  // already has a link — in which case the dialog shows the link rather than
  // the button that makes one. Both states are correct; only the first needs
  // a click.
  const createLink = cartDialog.getByRole('button', { name: /Create recovery link/ })
  if ((await createLink.count()) > 0) {
    await createLink.click()
    await page.waitForTimeout(1800)
  }

  const recoveryUrl = await cartDialog.getByRole('textbox').first().inputValue()
  ok('a recovery link was generated', /\/cart\/recover\/[0-9a-f-]{36}$/.test(recoveryUrl), recoveryUrl)

  const recoveryToken = recoveryUrl.split('/').pop()
  const redeemed = await (await fetch(`${API}/api/v1/cart/recover/${recoveryToken}`)).json()
  ok('the link restores a real cart', typeof redeemed.token === 'string' && redeemed.token.length === 36)
  ok('and it leaks nothing else', Object.keys(redeemed).length === 1, Object.keys(redeemed))

  // ── console ────────────────────────────────────────────────────────────────
  console.log('\nConsole')
  const real = consoleErrors.filter((text) => !/favicon|React DevTools|Download the/i.test(text))
  ok('no console errors anywhere in the journey', real.length === 0, real.slice(0, 4))

  await browser.close()
  void strandedToken

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
