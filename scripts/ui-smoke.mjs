/**
 * Headless click-through of the admin UI against a running API.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke.mjs
 *
 * Drives the flow a merchandiser actually performs: sign in, open the media
 * picker, upload an image through it, select it, create a product, and confirm
 * the featured thumbnail renders. Fails loudly on any console error.
 */
import { chromium } from 'playwright'
import { existsSync, writeFileSync } from 'node:fs'
import { clickNav } from './lib/sidebar.mjs'

// A trailing slash is stripped so `${BASE}/orders` never becomes `//orders`,
// and the root visit below re-adds it — `vite preview` serves the built bundle
// under the /admin/ base and answers a bare /admin with a hint page, not the app.
const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'

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

const API = process.env.API_BASE ?? 'http://127.0.0.1:4000'
/** The name this suite creates its product under, and therefore sweeps by. */
const SCRATCH_NAME = 'UI Smoke Serum'

/**
 * Remove every product this suite has ever left behind, not just this run's.
 *
 * Sweeping by name rather than by the id from this run on purpose: earlier runs
 * crashed, were interrupted, or predate the cleanup, and their rows are sitting
 * on the storefront right now. One pass here clears the backlog and keeps it
 * clear.
 */
async function sweepScratchProducts() {
  const login = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
    .then((response) => response.json())
    .catch(() => null)
  const token = login?.access_token ?? login?.tokens?.access_token
  if (!token) return { removed: 0, failed: 1, reason: 'could not sign in to tidy up' }

  const found = await fetch(`${API}/admin/api/v1/products?limit=250&q=${encodeURIComponent(SCRATCH_NAME)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((response) => response.json())
    .catch(() => null)

  const rows = (found?.data ?? found?.products ?? []).filter((product) => product.name === SCRATCH_NAME)
  let removed = 0
  let failedCount = 0
  for (const product of rows) {
    const response = await fetch(`${API}/admin/api/v1/products/${product.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) removed += 1
    else failedCount += 1
  }
  return { removed, failed: failedCount, found: rows.length }
}

// A 1400×1750 PNG, built in-page so every run has a unique checksum and the
// server's dedupe does not short-circuit the upload pipeline.
function makePngDataUrl() {
  return `(${function () {
    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = 1750
    const context = canvas.getContext('2d')
    context.fillStyle = `rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})`
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }})()`
}

const run = async () => {
  // This container ships a pinned Chromium; point at it rather than letting
  // Playwright try to download a build that matches its own version.
  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(
    existsSync(executablePath) ? { executablePath } : {},
  )
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  console.log('\nVeylog admin UI — smoke test\n')

  // ── login ─────────────────────────────────────────────────────────────────
  console.log('Login')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  // The redirect happens after React mounts, which is after networkidle.
  await page.waitForURL('**/login', { timeout: 10000 }).catch(() => {})
  ok('unauthenticated visit redirects to /login', page.url().includes('/login'), page.url())

  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  ok('signing in leaves the login page', !page.url().includes('/login'), page.url())
  // The sidebar is served by /menu-navigation now, so it paints a beat after
  // the route does — wait for it rather than asserting on the first frame.
  const mediaLink = page.getByRole('link', { name: 'Media' })
  await mediaLink.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  ok('sidebar renders the nav from the API', await mediaLink.isVisible().catch(() => false))

  // Where login lands is the app's choice and it has already changed once, so
  // this suite navigates to the screen it is about rather than assuming it is
  // already there.
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // ── product form + media picker ────────────────────────────────────────────
  console.log('\nProduct form')
  await page.getByRole('button', { name: 'Add product' }).click()
  await page.waitForURL('**/products/new')
  await page.getByLabel('Product name').waitFor({ state: 'visible' })
  ok('new product form opens', await page.getByLabel('Product name').isVisible())

  const sku = `UI-${Date.now().toString(36).toUpperCase()}`
  await page.getByLabel('Product name').fill('UI Smoke Serum')
  await page.getByLabel('Short description').fill('Created by the UI smoke test.')
  await page.getByLabel('Full INCI').fill('Aqua, Niacinamide (10%), Phenoxyethanol.')
  await page.getByLabel('Manufacturer / marketer').fill('Veylor Labs Pvt Ltd')
  await page.getByPlaceholder('VEY-SER-30').fill(sku)
  await page.getByPlaceholder('30ml').fill('30ml')

  // MRP then price — the inline guard flags price > MRP, so order matters.
  const numberFields = page.locator('input[type="number"]')
  await numberFields.nth(0).fill('799')
  await numberFields.nth(1).fill('699')
  await numberFields.nth(2).fill('50')

  console.log('\nMedia picker')
  await page.getByRole('button', { name: 'Add images', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  ok('picker dialog opens', await dialog.isVisible())
  ok('picker has Library and Upload tabs', await dialog.getByRole('tab', { name: 'Upload' }).isVisible())

  await dialog.getByRole('tab', { name: 'Upload' }).click()
  ok('upload tab shows the drop zone', await dialog.getByText(/Drag images here/).isVisible())

  const dataUrl = await page.evaluate(makePngDataUrl())
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
  await page.setInputFiles('input[type="file"]', {
    name: 'ui-smoke-pack-shot.png',
    mimeType: 'image/png',
    buffer,
  })

  // Upload succeeds → the picker flips back to Library with the new file ticked.
  await dialog.getByRole('tab', { name: 'Library' }).waitFor()
  await page.waitForTimeout(2500)
  const selectButton = dialog.getByRole('button', { name: /^Add/ })
  const selectLabel = await selectButton.textContent()
  ok('upload auto-selects the new file', /\(\d+\)/.test(selectLabel ?? ''), `button read "${selectLabel}"`)

  await selectButton.click()
  await dialog.waitFor({ state: 'hidden' })
  ok('picker closes after selecting', !(await dialog.isVisible().catch(() => false)))

  const featured = page.getByText('Featured')
  ok('selected image lands in the form as Featured', await featured.isVisible())

  // ── save + publish gate ────────────────────────────────────────────────────
  console.log('\nSave and publish')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  // Saving now returns to the listing rather than staying on the new product —
  // a deliberate change (see REDIRECT_TO_LISTING_AFTER_SAVE.md), so the suite
  // follows the product from the list instead of expecting to be left on it.
  await page.waitForURL('**/products', { timeout: 15000 })
  ok('save returns to the product list', page.url().endsWith('/products'), page.url())

  await page.waitForTimeout(1500)
  // A brand-new draft is not necessarily on the first page of the list, so the
  // suite asks the API which product it just created rather than hunting for a
  // row whose position depends on the list's sort order.
  const createdId = await page.evaluate(async (searchSku) => {
    const token = localStorage.getItem('veylog.access_token')
    const response = await fetch(`/admin/api/v1/products?q=${encodeURIComponent(searchSku)}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    return body.products?.[0]?.id ?? null
  }, sku)
  ok('save created the product', createdId !== null, createdId)

  await page.goto(`${BASE}/products/${createdId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  ok('the saved product opens', /\/products\/\d+$/.test(page.url()), page.url())

  await page.getByRole('button', { name: 'Publish' }).click()
  await page.waitForTimeout(2000)
  const statusChip = page.locator('.MuiChip-label', { hasText: /^active$/ })
  ok('publish succeeds with compliance fields filled', await statusChip.first().isVisible().catch(() => false))

  // ── list ───────────────────────────────────────────────────────────────────
  console.log('\nProducts list')
  await clickNav(page, 'Products')
  await page.waitForURL('**/products')
  await page.waitForTimeout(1200)
  ok('new product appears in the list', await page.getByText('UI Smoke Serum').first().isVisible())
  const thumb = page.locator('table img').first()
  ok('list row shows the product thumbnail', await thumb.isVisible().catch(() => false))

  // ── shades ─────────────────────────────────────────────────────────────────
  // A shade is a variant, so the card owns both. What is worth pinning is that
  // adding a colour creates the sellable row behind it, and that "sold out" is
  // worked out from stock rather than typed in — a stored flag would go stale
  // the moment inventory moved.
  console.log('\nShades')
  await page.goto(`${BASE}/products/${createdId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const shadesCard = page.locator('.MuiCard-root').filter({ hasText: 'Shades' }).first()
  ok('the product form has a Shades card', (await shadesCard.count()) === 1)

  const variantRowsBefore = await page.locator('table').last().locator('tbody tr').count()
  await shadesCard.getByRole('textbox', { name: /^Shade name/ }).fill('smoke rose')
  await shadesCard.getByRole('button', { name: /Add shade/ }).click()
  await page.waitForTimeout(800)

  ok(
    'adding a shade adds the row',
    (await page.locator('[data-shade="smoke rose"]').count()) === 1,
  )
  const variantRowsAfter = await page.locator('table').last().locator('tbody tr').count()
  ok(
    'and creates the sellable variant behind it',
    variantRowsAfter === variantRowsBefore + 1,
    `${variantRowsBefore} → ${variantRowsAfter}`,
  )

  // Targeted by placeholder, not by index: the row also holds a colour input,
  // and counting textboxes put the descriptor's text into the shade's name —
  // which renamed the row and made it disappear from under the locator.
  const shadeRow = page.locator('[data-shade="smoke rose"]')
  await shadeRow.getByPlaceholder('shimmery apricot').fill('warm neutral')
  ok(
    'a shade takes a descriptor',
    (await shadeRow.getByPlaceholder('shimmery apricot').inputValue()) === 'warm neutral',
  )
  await shadeRow.getByPlaceholder('limited edition').fill('new')
  ok('and a badge', (await shadeRow.getByPlaceholder('limited edition').inputValue()) === 'new')

  // Stock is zero on a shade just invented, so the site would call it sold out.
  ok(
    'a shade with no stock reads as sold out, without anyone saying so',
    (await shadeRow.innerText()).includes('sold out'),
  )

  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await page.waitForTimeout(2500)

  // Read through the page, using the token the app already holds — the same
  // idiom the created-product lookup above uses.
  const shadeOption = await page.evaluate(async (productId) => {
    const token = localStorage.getItem('veylog.access_token')
    const response = await fetch(`/admin/api/v1/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    return (body.product?.options ?? []).find((option) => option.name.toLowerCase() === 'shade') ?? null
  }, createdId)
  const savedShade = (shadeOption?.values ?? []).find((value) => value.value === 'smoke rose')
  ok('the shade survives a save', Boolean(savedShade), JSON.stringify(shadeOption?.values?.map((v) => v.value)))
  ok('with its descriptor', savedShade?.descriptor === 'warm neutral', savedShade?.descriptor)
  ok('and its badge', savedShade?.badge === 'new', savedShade?.badge)
  ok('and the API agrees it is sold out', savedShade?.is_sold_out === true, String(savedShade?.is_sold_out))

  // ── media library page ─────────────────────────────────────────────────────
  console.log('\nMedia library')
  await clickNav(page, 'Media')
  await page.waitForURL('**/media')
  await page.waitForTimeout(1500)
  const tiles = await page.locator('[role="button"] img, [role="checkbox"] img').count()
  ok('library renders uploaded files', tiles > 0, `${tiles} tiles`)

  await page.screenshot({ path: '/tmp/ui-media-library.png', fullPage: false })

  // ── console hygiene ────────────────────────────────────────────────────────
  console.log('\nConsole')
  // React's dev-mode warnings are noisy but real; anything logged as an error
  // during a happy path is a defect worth failing on.
  const meaningful = consoleErrors.filter(
    (text) => !text.includes('Download the React DevTools') && !text.includes('favicon'),
  )
  ok('no console errors during the happy path', meaningful.length === 0, meaningful.slice(0, 3).join(' | '))

  await browser.close()

  // ── tidy up ────────────────────────────────────────────────────────────────
  // This suite creates a product every run, and for a long time it left it
  // there: twenty-five "UI Smoke Serum" rows ended up public on the live
  // storefront, outnumbering the real catalogue. A suite that pollutes the shop
  // it is testing is worse than no suite.
  console.log('\nTidy up')
  const swept = await sweepScratchProducts()
  ok('the scratch products this suite makes are removed', swept.failed === 0, JSON.stringify(swept))

  console.log(`\n${'='.repeat(48)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  if (failures.length) console.log(`\n  Failed:\n${failures.map((f) => `    - ${f}`).join('\n')}`)
  console.log(`${'='.repeat(48)}\n`)
  writeFileSync('/tmp/ui-smoke-result.json', JSON.stringify({ passed, failed, failures }, null, 2))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nUI smoke crashed:', error)
  process.exit(1)
})
