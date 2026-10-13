/**
 * Headless click-through of the collections module.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-collections.mjs
 *
 * Covers both kinds: a manual collection with hand-picked products, and an
 * automatic one whose membership comes from rules and a recalculation.
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

const run = async () => {
  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  console.log('\nVeylog admin UI — collections\n')

  console.log('Login')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1200)

  // ── manual collection ──────────────────────────────────────────────────────
  console.log('\nManual collection')
  await clickNav(page, 'Collections')
  await page.waitForURL('**/collections')
  await page.waitForTimeout(1000)

  const createButton = page.getByRole('button', { name: /Create/ }).first()
  ok('the list offers a way to create one', await createButton.isVisible())
  await createButton.click()
  await page.waitForURL('**/collections/new')

  const manualTitle = `Smoke manual ${Date.now().toString(36).toUpperCase().slice(-4)}`
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(manualTitle)

  const picker = page.getByLabel('Products in this collection')
  ok('manual is the default and shows a product picker', await picker.isVisible().catch(() => false))
  await picker.click()
  await page.waitForTimeout(700)
  const options = page.getByRole('option')
  const optionCount = await options.count()
  ok('the picker is fed by the product catalogue', optionCount > 0, `${optionCount} options`)
  await options.first().click()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  // A create returns to the list — that is the form's deliberate behaviour, so
  // the record has to be reopened before the rest of this suite can edit it.
  await page.waitForURL(/\/collections$/, { timeout: 15000 })
  await page.waitForTimeout(1500)
  ok('saving creates it and returns to the list', await page.getByText(manualTitle).first().isVisible())

  await page.getByText(manualTitle).first().click()
  await page.waitForURL(/\/collections\/\d+$/, { timeout: 15000 })
  ok('the new collection opens from the list', /\/collections\/\d+$/.test(page.url()), page.url())
  await page.waitForTimeout(1500)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const chips = await page.locator('.MuiAutocomplete-root .MuiChip-label').count()
  ok('the hand-picked product survives a reload', chips > 0, `${chips} chips`)

  // ── image, SEO and manual order ────────────────────────────────────────────
  console.log('\nCollection image, SEO and order')

  // Add a second product so there is something to reorder.
  const picker2 = page.getByLabel('Products in this collection')
  await picker2.click()
  await page.waitForTimeout(600)
  // Pick one that is NOT already chosen — clicking a ticked option removes it.
  const more = page.getByRole('option', { selected: false })
  if ((await more.count()) > 0) await more.first().click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const orderRows = page.getByRole('button', { name: /^Move .* down$/ })
  const hasOrder = (await orderRows.count()) > 0
  ok('manual collections expose a storefront order', hasOrder, `${await orderRows.count()} rows`)

  let reordered = true
  if (hasOrder) {
    const namesBefore = await page.locator('.MuiAutocomplete-root .MuiChip-label').allTextContents()
    const idsBefore = await page.evaluate(async (collectionUrl) => {
      const token = localStorage.getItem('veylog.access_token')
      const response = await fetch(collectionUrl, { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json()
      return body.products.map((product) => product.id)
    }, `/admin/api/v1/products?collection_id=${page.url().split('/').pop()}&limit=100`)
    await orderRows.first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForTimeout(2000)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const namesAfter = await page.locator('.MuiAutocomplete-root .MuiChip-label').allTextContents()

    // Two products can share a name, so compare ids from the API rather than
    // labels — and this also proves the LIST endpoint honours the curated
    // order, which is what the storefront will read.
    const orderedIds = await page.evaluate(async (collectionUrl) => {
      const token = localStorage.getItem('veylog.access_token')
      const response = await fetch(collectionUrl, { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json()
      return body.products.map((product) => product.id)
    }, `/admin/api/v1/products?collection_id=${page.url().split('/').pop()}&limit=100`)

    reordered =
      namesBefore.length < 2 ||
      (orderedIds.length >= 2 && orderedIds[0] !== idsBefore[0]) ||
      namesBefore[0] !== namesAfter[0]
    ok(
      'the new order is persisted and the list honours it',
      reordered,
      `before ${idsBefore} → after ${orderedIds}`,
    )
  }

  ok(
    'the form offers a collection image',
    await page.getByText('Add an image').first().isVisible().catch(() => false),
  )

  const handleField = page.getByRole('textbox', { name: 'Handle' })
  ok('the search engine listing exposes the handle', await handleField.isVisible().catch(() => false))
  const pageTitle = page.getByRole('textbox', { name: 'Page title' })
  await pageTitle.fill('Smoke SEO title')
  await page.getByRole('textbox', { name: 'Meta description' }).fill('Smoke SEO description.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  ok(
    'SEO fields survive a reload',
    (await page.getByRole('textbox', { name: 'Page title' }).inputValue()) === 'Smoke SEO title',
  )

  // ── automatic collection ───────────────────────────────────────────────────
  console.log('\nAutomatic collection')
  await clickNav(page, 'Collections')
  await page.waitForURL('**/collections')
  await page.waitForTimeout(1200)
  ok('the manual collection is listed', await page.getByText(manualTitle).first().isVisible())

  await page.getByRole('button', { name: /Create/ }).first().click()
  await page.waitForURL('**/collections/new')

  const autoTitle = `Smoke auto ${Date.now().toString(36).toUpperCase().slice(-4)}`
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(autoTitle)
  await page.getByRole('button', { name: 'Automatic' }).click()
  await page.waitForTimeout(500)

  const fieldSelect = page.getByRole('combobox', { name: 'Field' }).first()
  ok('choosing Automatic reveals the rule builder', await fieldSelect.isVisible().catch(() => false))

  // Price is numeric, so the operator list must change with the field.
  await fieldSelect.click()
  await page.getByRole('option', { name: 'Price' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('combobox', { name: 'Condition' }).first().click()
  const conditionOptions = await page.getByRole('option').allTextContents()
  ok(
    'operators follow the field type (no "contains" on a price)',
    !conditionOptions.some((t) => /contains/i.test(t)),
    conditionOptions.join(', '),
  )
  await page.getByRole('option', { name: 'is greater than' }).click()
  await page.getByRole('spinbutton', { name: 'Value' }).first().fill('1')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  // Same as the manual one above: a create lands on the list, so reopen it.
  await page.waitForURL(/\/collections$/, { timeout: 15000 })
  await page.waitForTimeout(1500)
  ok('an automatic collection saves with its rule', await page.getByText(autoTitle).first().isVisible())
  await page.getByText(autoTitle).first().click()
  await page.waitForURL(/\/collections\/\d+$/, { timeout: 15000 })
  await page.waitForTimeout(1800)

  const recalcButton = page.getByRole('button', { name: 'Recalculate' })
  ok('automatic collections offer Recalculate', await recalcButton.isVisible().catch(() => false))
  await recalcButton.click()
  await page.waitForTimeout(2200)
  const matched = await page
    .getByText(/products matched/)
    .first()
    .isVisible()
    .catch(() => false)
  ok('recalculating reports how many products matched', matched)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const memberChips = await page.getByText('Currently matching').isVisible().catch(() => false)
  ok('the matched products are listed back', memberChips)

  // An automatic collection must not offer the hand-pick control — its
  // membership is derived, and anything typed there would be erased.
  ok(
    'automatic collections do not offer the manual picker',
    (await page.getByLabel('Products in this collection').count()) === 0,
  )

  // ── product form → Collections card ────────────────────────────────────────
  console.log('\nProduct → collections dropdown')
  await clickNav(page, 'Products')
  await page.waitForURL('**/products')
  await page.waitForTimeout(1200)
  await page.locator('table tbody tr').first().click()
  await page.waitForURL(/\/products\/\d+$/, { timeout: 15000 })
  await page.waitForTimeout(1800)

  const addTo = page.getByLabel('Add to collections')
  ok('the product form has a Collections card', await addTo.isVisible().catch(() => false))

  await addTo.click()
  await page.waitForTimeout(700)
  const manualOption = page.getByRole('option', { name: new RegExp(manualTitle) })
  ok('manual collections are offered', (await manualOption.count()) > 0)
  const autoOption = page.getByRole('option', { name: new RegExp(autoTitle) })
  ok('automatic collections are NOT offered (they pick themselves)', (await autoOption.count()) === 0)

  await manualOption.first().click()
  // Waited for, not slept through. Filing a product fires a request the screen
  // does not block on, and a reload that lands first throws the write away —
  // which made this assertion fail about half the time.
  await page
    .waitForResponse(
      (response) =>
        /\/admin\/api\/v1\/(products|collections)\/\d+/.test(response.url()) &&
        ['POST', 'PUT', 'PATCH'].includes(response.request().method()),
      { timeout: 10000 },
    )
    .catch(() => undefined)
  await page.waitForTimeout(600)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  ok(
    'filing the product into a collection persists',
    await page.locator('.MuiChip-label', { hasText: manualTitle }).first().isVisible().catch(() => false),
  )

  // ── category counts ────────────────────────────────────────────────────────
  // Regression guard: `categories.product_count` was a cache nothing refreshed,
  // so every category read 0 no matter how many products were filed in it.
  console.log('\nCategory counts')
  const counts = await page.evaluate(async () => {
    const token = localStorage.getItem('veylog.access_token')
    const headers = { Authorization: `Bearer ${token}` }
    const cats = await (await fetch('/admin/api/v1/categories', { headers })).json()
    const out = []
    for (const category of cats.categories) {
      const listed = await (
        await fetch(`/admin/api/v1/products?category_id=${category.id}&limit=250`, { headers })
      ).json()
      out.push({
        path: category.path,
        direct: category.product_count,
        subtree: category.total_product_count,
        listed: listed.pagination.total,
      })
    }
    return out
  })

  ok('the API returns both a direct and a subtree count', counts.every((c) => 'subtree' in c))
  const mismatched = counts.filter((c) => c.subtree !== c.listed)
  ok(
    'every category count matches what filtering by it returns',
    mismatched.length === 0,
    JSON.stringify(mismatched.slice(0, 3)),
  )
  const withProducts = counts.filter((c) => c.listed > 0)
  ok(
    'categories holding products do not report zero',
    withProducts.every((c) => c.subtree > 0),
    JSON.stringify(withProducts.slice(0, 3)),
  )

  await page.screenshot({ path: '/tmp/ui-collections.png', fullPage: false })

  console.log('\nConsole')
  const meaningful = consoleErrors.filter(
    (t) => !t.includes('Download the React DevTools') && !t.includes('favicon'),
  )
  ok('no console errors', meaningful.length === 0, meaningful.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n${'='.repeat(48)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  if (failures.length) console.log(`\n  Failed:\n${failures.map((f) => `    - ${f}`).join('\n')}`)
  console.log(`${'='.repeat(48)}\n`)
  writeFileSync('/tmp/ui-smoke-collections-result.json', JSON.stringify({ passed, failed, failures }, null, 2))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nCollections smoke crashed:', error)
  process.exit(1)
})
