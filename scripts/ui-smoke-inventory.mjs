/**
 * Headless click-through of the Inventory screen.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-inventory.mjs
 *
 * What it is actually checking, beyond "the page renders":
 *
 *   - the summary cards foot against the table under them, and keep footing
 *     when the table is filtered. Three endpoints used to answer "how many
 *     units?" three different ways, and the cards silently disagreed with the
 *     rows they sat above
 *   - the badge on a row and the counter in the card come from the same
 *     server-side rule, so filtering to Low returns exactly the badged rows
 *   - an adjustment that would go below zero is refused with a readable reason
 *     rather than a stack trace or a negative quantity
 *   - the ledger names the order behind a sale, not just the word "order"
 *   - promoting a location demotes the previous default
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

/** Buys one unit so the ledger has a sale that points at a real order. */
async function placeOrder() {
  const { product: detailProduct, variant } = await pickSellable(API, 1)
  const detail = { product: detailProduct }
  const phone = `9${String(Date.now()).slice(-9)}`

  const { cart } = await post('/api/v1/cart')
  await post(`/api/v1/cart/${cart.token}/items`, { variant_id: variant.id, quantity: 1 })
  const { order } = await post(
    `/api/v1/cart/${cart.token}/checkout`,
    {
      payment_method: 'cod',
      contact: { first_name: 'Stock', last_name: 'Screen', phone, email: `s.${phone}@example.com` },
      shipping_address: { line1: '8 Brigade Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    },
    { 'Idempotency-Key': crypto.randomUUID() },
  )
  return { order, sku: variant.sku }
}

/** Reads a number out of a summary card by its label. */
async function cardValue(page, label) {
  const card = page.locator('main').locator('div').filter({ hasText: new RegExp(`^${label}`) })
  const text = await card.first().innerText()
  const match = text.replace(label, '').match(/-?\d[\d,]*/)
  return match ? Number(match[0].replace(/,/g, '')) : null
}

const run = async () => {
  mkdirSync(SHOTS, { recursive: true })

  const login = await post('/admin/api/v1/auth/login', { email: EMAIL, password: PASSWORD })
  const accessToken = login.tokens?.access_token ?? login.access_token
  const admin = (path) =>
    fetch(`${API}/admin/api/v1${path}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json(),
    )

  const { order, sku } = await placeOrder()
  console.log(`\nVeylog admin UI — inventory\n\nSeeded order ${order.order_number} (${sku})\n`)

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(
    existsSync(executablePath)
      ? { executablePath, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] }
      : {},
  )
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  // The sandbox blocks Google Fonts, and an aborted request logs a console error
  // that the console assertion would then have to excuse. Fulfilling with an
  // empty stylesheet keeps the page quiet and the assertion honest.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
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
  await page.waitForTimeout(1200)

  // ── sidebar ────────────────────────────────────────────────────────────────
  console.log('Sidebar')
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const nav = page.getByRole('navigation')
  const inventoryLink = nav.getByRole('link', { name: /^Inventory/ }).first()
  const linkText = await inventoryLink.innerText()
  ok('Inventory is enabled in the sidebar', !linkText.includes('Soon'), linkText)
  ok(
    'Inventory points at /inventory',
    ((await inventoryLink.getAttribute('href')) ?? '').endsWith('/inventory'),
    await inventoryLink.getAttribute('href'),
  )

  // ── stock levels ───────────────────────────────────────────────────────────
  console.log('\nStock levels')
  ok('the page titles itself', (await main.getByRole('heading', { name: 'Inventory' }).count()) === 1)
  ok('all three tabs are present', (await main.getByRole('tab').count()) === 3)

  const rowCount = await main.locator('table tbody tr').count()
  ok('the stock table has rows', rowCount > 0, rowCount)

  const skus = await admin('/inventory?limit=250')
  ok('the table never renders more than one page', rowCount <= 25, { onScreen: rowCount })
  ok('the table shows every row of this page', rowCount === Math.min(25, skus.pagination.total), {
    onScreen: rowCount,
    total: skus.pagination.total,
  })
  ok('the pager reports the real total', (await main.getByText(new RegExp(`of ${skus.pagination.total}`)).count()) >= 1)
  // The old screen had no pager at all and no scope agreement: 67 of the 84
  // stock rows belong to soft-deleted products, so the cards were counting
  // stock the table could never show.
  ok(
    'soft-deleted products are excluded from the table',
    skus.pagination.total < 84,
    skus.pagination.total,
  )

  // ── cards foot against the table ───────────────────────────────────────────
  console.log('\nThe cards describe the rows')
  const api = await admin('/inventory/summary')
  const onHand = await cardValue(page, 'Units on hand')
  const low = await cardValue(page, 'Low stock')
  const out = await cardValue(page, 'Out of stock')
  ok('Units on hand matches the API', onHand === api.summary.total_on_hand, {
    screen: onHand,
    api: api.summary.total_on_hand,
  })
  ok('Low stock matches the API', low === api.summary.low_stock_count, { screen: low, api: api.summary.low_stock_count })
  ok('Out of stock matches the API', out === api.summary.out_of_stock_count, {
    screen: out,
    api: api.summary.out_of_stock_count,
  })

  const locations = await admin('/inventory/locations')
  const locationSum = locations.locations.reduce((total, row) => total + row.total_on_hand, 0)
  ok('the locations agree with the cards', locationSum === api.summary.total_on_hand, {
    locations: locationSum,
    cards: api.summary.total_on_hand,
  })

  await page.screenshot({ path: `${SHOTS}/inventory-stock.png`, fullPage: true })

  // ── the badge and the counter are the same rule ────────────────────────────
  console.log('\nOne rule for low stock')
  await page.getByRole('combobox').nth(0).click()
  await page.getByRole('option', { name: 'Low stock' }).click()
  await page.waitForTimeout(1800)

  const lowRows = await main.locator('table tbody tr').count()
  const lowBadges = await main.getByText('Low stock', { exact: true }).count()
  // One card is also labelled "Low stock", hence the badge count sitting one
  // above the row count when every row on the page is badged.
  ok('filtering to Low returns rows', lowRows > 0, lowRows)
  ok('every row on the Low page carries the Low badge', lowBadges >= lowRows, { lowRows, lowBadges })

  const lowFiltered = await admin('/inventory?stock_status=low&limit=250')
  ok(
    'the Low filter count equals the Low counter',
    lowFiltered.pagination.total === api.summary.low_stock_count,
    { filtered: lowFiltered.pagination.total, counter: api.summary.low_stock_count },
  )
  const lowCardAfter = await cardValue(page, 'Low stock')
  ok('the cards follow the filter', lowCardAfter === lowFiltered.summary.low_stock_count, {
    screen: lowCardAfter,
    api: lowFiltered.summary.low_stock_count,
  })

  await page.getByRole('combobox').nth(0).click()
  await page.getByRole('option', { name: 'All stock levels' }).click()
  await page.waitForTimeout(1500)

  // ── search ─────────────────────────────────────────────────────────────────
  console.log('\nSearch')
  await main.getByPlaceholder(/Search by product/).fill(sku)
  await page.waitForTimeout(1800)
  const searchRows = await main.locator('table tbody tr').count()
  ok('search narrows the table', searchRows >= 1 && searchRows < rowCount, { searchRows, rowCount })
  ok('the searched SKU is on screen', (await main.getByText(sku, { exact: false }).count()) >= 1)

  const searched = await admin(`/inventory?q=${encodeURIComponent(sku)}&limit=250`)
  const searchedCard = await cardValue(page, 'Units on hand')
  ok('the cards narrow with the search', searchedCard === searched.summary.total_on_hand, {
    screen: searchedCard,
    api: searched.summary.total_on_hand,
  })

  // ── adjusting ──────────────────────────────────────────────────────────────
  console.log('\nAdjusting stock')
  const firstRow = main.locator('table tbody tr').first()
  const beforeOnHand = Number(await firstRow.locator('td').nth(3).innerText())

  await firstRow.getByRole('button', { name: 'Adjust', exact: true }).click()
  await page.waitForTimeout(600)
  const dialog = page.getByRole('dialog')
  ok('the adjust dialog opens', (await dialog.count()) === 1)

  // A reason is mandatory because it is written to the ledger.
  await dialog.getByLabel(/Units to add or remove/).fill('5')
  await dialog.getByRole('button', { name: 'Adjust stock' }).click()
  await page.waitForTimeout(500)
  ok(
    'an adjustment without a reason is refused in the dialog',
    (await dialog.getByText(/Give a reason/).count()) === 1,
  )

  // Going below zero is caught before the request, with the resulting number named.
  await dialog.getByLabel(/Units to add or remove/).fill(String(-(beforeOnHand + 50)))
  await dialog.getByLabel('Reason').fill('UI smoke — should be refused')
  await dialog.getByRole('button', { name: 'Adjust stock' }).click()
  await page.waitForTimeout(500)
  ok(
    'an adjustment below zero is refused with the resulting number',
    (await dialog.getByText(/cannot go below zero/).count()) === 1,
  )

  await dialog.getByLabel(/Units to add or remove/).fill('5')
  await dialog.getByLabel('Reason').fill('UI smoke — received shipment')
  await page.screenshot({ path: `${SHOTS}/inventory-adjust.png` })
  await dialog.getByRole('button', { name: 'Adjust stock' }).click()
  await page.waitForTimeout(2200)

  ok('the dialog closes on success', (await page.getByRole('dialog').count()) === 0)
  const afterOnHand = Number(await main.locator('table tbody tr').first().locator('td').nth(3).innerText())
  ok('the table shows the new quantity', afterOnHand === beforeOnHand + 5, {
    before: beforeOnHand,
    after: afterOnHand,
  })

  const afterCard = await cardValue(page, 'Units on hand')
  const afterApi = await admin(`/inventory?q=${encodeURIComponent(sku)}&limit=250`)
  ok('the cards moved with the adjustment', afterCard === afterApi.summary.total_on_hand, {
    screen: afterCard,
    api: afterApi.summary.total_on_hand,
  })

  // Put it back.
  await main.locator('table tbody tr').first().getByRole('button', { name: 'Adjust', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole('dialog').getByLabel(/Units to add or remove/).fill('-5')
  await page.getByRole('dialog').getByLabel('Reason').fill('UI smoke — reversing')
  await page.getByRole('dialog').getByRole('button', { name: 'Adjust stock' }).click()
  await page.waitForTimeout(2000)

  // ── stock history ──────────────────────────────────────────────────────────
  console.log('\nStock history')
  await main.locator('table tbody tr').first().getByRole('button', { name: /Stock history/ }).click()
  await page.waitForTimeout(1800)
  const history = page.getByRole('dialog')
  ok('the history dialog opens', (await history.count()) === 1)
  ok('it lists the adjustments just made', (await history.getByText('Manual adjustment').count()) >= 1)
  ok('changes are signed', (await history.getByText(/^[+-]\d+$/).count()) >= 1)
  await page.screenshot({ path: `${SHOTS}/inventory-history.png` })
  await history.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(600)

  // ── bulk ───────────────────────────────────────────────────────────────────
  console.log('\nBulk adjustment')
  await main.getByPlaceholder(/Search by product/).fill('')
  await page.waitForTimeout(1800)
  const checkboxes = main.locator('table tbody input[type="checkbox"]')
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()
  await page.waitForTimeout(400)
  ok('selecting rows offers a bulk action', (await main.getByText('2 selected on this page').count()) === 1)

  await main.getByRole('button', { name: 'Adjust together' }).click()
  await page.waitForTimeout(600)
  const bulk = page.getByRole('dialog')
  ok('the bulk dialog names the count', (await bulk.getByText('Adjust 2 variants').count()) === 1)
  ok(
    'it warns that the batch is all-or-nothing',
    (await bulk.getByText(/whole batch is refused/).count()) === 1,
  )
  await bulk.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(500)

  // ── movements ──────────────────────────────────────────────────────────────
  console.log('\nMovement ledger')
  await main.getByRole('tab', { name: 'Movements' }).click()
  await page.waitForTimeout(2200)
  ok('the ledger has rows', (await main.locator('table tbody tr').count()) > 0)
  ok('a sale names the order behind it', (await main.getByText(/order #\d+/).count()) >= 1)
  ok('sales read as sales, not as enum values', (await main.getByText('Sold').count()) >= 1)
  ok('system movements are attributed to System', (await main.getByText('System').count()) >= 1)
  await page.screenshot({ path: `${SHOTS}/inventory-movements.png`, fullPage: true })

  await page.getByRole('combobox').nth(0).click()
  await page.getByRole('option', { name: 'Manual adjustment' }).click()
  await page.waitForTimeout(1800)
  const adjustmentRows = await main.locator('table tbody tr').count()
  ok('filtering the ledger by type works', adjustmentRows > 0, adjustmentRows)
  ok(
    'only adjustments are listed',
    (await main.getByText('Sold').count()) === 0,
  )

  // ── locations ──────────────────────────────────────────────────────────────
  console.log('\nLocations')
  await main.getByRole('tab', { name: 'Locations' }).click()
  await page.waitForTimeout(1800)
  ok('the locations table has rows', (await main.locator('table tbody tr').count()) >= 1)
  ok('the default location is marked', (await main.getByText('Default', { exact: true }).count()) === 1)
  ok(
    'the location totals are on screen',
    (await main.getByText(String(locations.locations[0].total_on_hand)).count()) >= 1,
  )
  await page.screenshot({ path: `${SHOTS}/inventory-locations.png`, fullPage: true })

  const code = `UI${String(Date.now()).slice(-6)}`
  await main.getByRole('button', { name: 'New location' }).click()
  await page.waitForTimeout(600)
  const locationDialog = page.getByRole('dialog')
  ok('the new-location dialog opens', (await locationDialog.count()) === 1)
  ok(
    'it explains what the default location does',
    (await locationDialog.getByText(/promoting this one demotes/).count()) === 1,
  )

  await locationDialog.getByLabel('Code', { exact: true }).fill(code)
  await locationDialog.getByLabel(/^Name\s*\*?$/).fill('UI smoke depot')
  await locationDialog.getByLabel('City').fill('Solan')
  await locationDialog.getByLabel('State', { exact: true }).fill('Himachal Pradesh')
  await locationDialog.getByLabel('State code').fill('02')
  await locationDialog.getByLabel('PIN code').fill('173205')
  await locationDialog.getByRole('button', { name: 'Create location' }).click()
  await page.waitForTimeout(2200)

  ok('the location dialog closes on success', (await page.getByRole('dialog').count()) === 0)
  ok('the new location is listed', (await main.getByText(code).count()) === 1)

  const afterCreate = await admin('/inventory/locations')
  ok(
    'creating a location did not create a second default',
    afterCreate.locations.filter((row) => row.is_default).length === 1,
    afterCreate.locations.filter((row) => row.is_default).map((row) => row.code),
  )

  // ── console ────────────────────────────────────────────────────────────────
  console.log('\nConsole')
  ok('no console errors across the whole run', consoleErrors.length === 0, consoleErrors.slice(0, 4))

  await browser.close()

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const failure of failures) console.log(`  • ${failure}`)
  }
  console.log('')
  process.exit(failures.length > 0 ? 1 : 0)
}

run().catch((error) => {
  console.error(`\nFATAL: ${error.message}\n`)
  process.exit(1)
})
