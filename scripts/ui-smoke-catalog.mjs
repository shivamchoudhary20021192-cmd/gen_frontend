/**
 * Browser smoke test for Products (new), as staff use it: the sidebar entry
 * beside the classic Products; a custom field with preset choices; a product
 * made with two options, whose variants appear as values are added; saving it
 * with a field filled in; renaming a value keeping the variants; the classic
 * editor showing it read-only; and the metaobjects screens.
 *
 *   ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 BACKEND_DIR=D:/veylog-backend-themes \
 *   PW_CHANNEL=chrome SHOTS_DIR=… node scripts/ui-smoke-catalog.mjs
 *
 * Creates (and deletes at the end) a product, a field and a metaobject type —
 * run it against a scratch database.
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
const run = Date.now().toString(36)

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
  const api = (method, url, body) =>
    fetch(`${API}/admin/api/v1${url}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))

  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await context.addInitScript(([a, r]) => {
    localStorage.setItem('veylog.access_token', a)
    localStorage.setItem('veylog.refresh_token', r)
  }, [access, refresh])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const cleanup = []

  try {
    process.stdout.write('\nThe menu\n')
    await page.goto(`${BASE}/catalog/products`, { waitUntil: 'load', timeout: 90000 })
    ok('the list opens, with status tabs', await visible(page.getByRole('tab', { name: /^All/ }), 60000))
    ok('"Products (new)" is in the sidebar', await visible(page.getByRole('navigation', { name: 'Main' }).getByText('Products (new)')))
    ok('beside the classic Products', await visible(page.getByRole('navigation', { name: 'Main' }).getByText('Products', { exact: true })))
    await page.screenshot({ path: `${SHOTS}/catalog-1-list.png` })

    process.stdout.write('\nA custom field\n')
    await page.goto(`${BASE}/catalog/custom-fields`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add field' }).click()
    const fieldDialog = page.getByRole('dialog')
    const fieldName = `Fabric ${run}`
    await fieldDialog.getByLabel('Name', { exact: true }).fill(fieldName)
    ok('the key is made from the name', (await fieldDialog.getByLabel('Key').inputValue()) === `fabric_${run}`)
    const choices = fieldDialog.getByLabel('Preset choices')
    for (const choice of ['Cotton', 'Linen']) {
      await choices.fill(choice)
      await choices.press('Enter')
    }
    await page.screenshot({ path: `${SHOTS}/catalog-2-field.png` })
    await fieldDialog.getByRole('button', { name: 'Save' }).click()
    const fieldRow = page.getByRole('row').filter({ hasText: fieldName })
    ok('the field is listed, as a dropdown with 2 choices', await visible(fieldRow.getByText('2 choices')))
    const defs = await api('GET', '/catalog/definitions?owner_type=product')
    const field = defs.body.definitions.find((d) => d.name === fieldName)
    if (field) cleanup.push(() => api('DELETE', `/catalog/definitions/${field.id}`))

    process.stdout.write('\nA product with options\n')
    await page.goto(`${BASE}/catalog/products/new`, { waitUntil: 'load' })
    const title = `UI linen shirt ${run}`
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await page.getByRole('button', { name: 'Add options like size or colour' }).click()
    await page.getByLabel('Option name').first().fill('Size')
    await page.getByPlaceholder('Small').fill('S')
    await page.getByRole('button', { name: 'Add value' }).first().click()
    await page.getByPlaceholder('Another value').last().fill('M')
    await page.getByRole('button', { name: 'Add another option' }).click()
    await page.getByLabel('Option name').nth(1).fill('Colour')
    await page.getByPlaceholder('Red').fill('White')
    await page.getByRole('button', { name: 'Add value' }).nth(1).click()
    await page.getByPlaceholder('Another value').last().fill('Sand')
    const variantRows = page.getByRole('row').filter({ hasText: / \/ / })
    ok('four variants appear, one per combination', (await variantRows.count()) === 4, await variantRows.allTextContents())
    ok('titled by their values ("S / White")', await visible(page.getByRole('cell', { name: 'S / White' })))
    const prices = page.getByRole('row').filter({ hasText: / \/ / }).locator('input[type=number]')
    for (let i = 0; i < 4; i += 1) await prices.nth(i * 3).fill(String(1299 + i * 100))
    await page.getByLabel(fieldName, { exact: true }).click()
    await page.getByRole('option', { name: 'Linen' }).click()
    await page.screenshot({ path: `${SHOTS}/catalog-3-new-product.png`, fullPage: true })
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/catalog\/products\/\d+$/, { timeout: 30000 }).catch(() => {})
    const productId = Number(page.url().split('/').pop())
    ok('saved, and the page moves to the product', productId > 0, page.url())
    if (productId > 0) cleanup.push(() => api('DELETE', `/catalog/products/${productId}`))
    ok('the SKUs are filled in', await visible(page.locator('input[value^="UI-LINEN-SHIRT"]').first()))
    const saved = productId > 0 ? (await api('GET', `/catalog/products/${productId}`)).body.product : null
    ok('the API has 4 variants and the field value', saved?.variants?.length === 4 && saved?.metafields?.some((m) => m.value === 'Linen'), saved?.metafields)
    const variantIds = saved?.variants?.map((v) => v.id) ?? []

    process.stdout.write('\nEditing keeps the variants\n')
    await page.getByPlaceholder('Another value').filter({ has: page.locator('[value="Sand"]') }).or(page.locator('input[value="Sand"]')).first().fill('Stone')
    ok('renaming a value renames its variants', await visible(page.getByRole('cell', { name: 'S / Stone' })))
    ok('and the page knows there is something to save', await page.getByRole('button', { name: 'Discard' }).isVisible())
    await page.getByRole('button', { name: 'Save' }).click()
    ok('saved', await visible(page.getByText('Product saved')))
    const after = (await api('GET', `/catalog/products/${productId}`)).body.product
    ok('with the same variant ids', JSON.stringify(after?.variants?.map((v) => v.id)) === JSON.stringify(variantIds), [variantIds, after?.variants?.map((v) => v.id)])
    await page.getByRole('row').filter({ hasText: 'M / Stone' }).getByRole('button', { name: 'Edit variant' }).click()
    const variantDialog = page.getByRole('dialog')
    ok('a variant opens with its pricing, inventory and shipping', await visible(variantDialog.getByLabel('Cost per item')))
    await variantDialog.getByLabel('Cost per item').fill('600')
    ok('and shows the margin', await visible(variantDialog.getByText(/margin \d+%/)))
    await page.screenshot({ path: `${SHOTS}/catalog-4-variant.png` })
    await variantDialog.getByRole('button', { name: 'Done' }).click()

    process.stdout.write('\nThe classic editor\n')
    await page.goto(`${BASE}/products/${productId}`, { waitUntil: 'load' })
    ok('shows it read-only, pointing to Products (new)', await visible(page.getByText('This product is managed in Products (new)')))
    await page.screenshot({ path: `${SHOTS}/catalog-5-classic.png` })

    process.stdout.write('\nMetaobjects\n')
    await page.goto(`${BASE}/catalog/metaobjects`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add type' }).click()
    const typeDialog = page.getByRole('dialog')
    const typeName = `Care guide ${run}`
    await typeDialog.getByLabel('Name', { exact: true }).fill(typeName)
    await typeDialog.getByRole('button', { name: 'Save' }).click()
    ok('a type is made and its entries open', await visible(page.getByRole('button', { name: 'Add entry' })))
    const types = await api('GET', '/catalog/metaobject-definitions')
    const madeType = types.body.definitions.find((d) => d.name === typeName)
    if (madeType) cleanup.push(() => api('DELETE', `/catalog/metaobject-definitions/${madeType.id}`))
    await page.getByRole('button', { name: 'Add entry' }).click()
    await page.getByRole('dialog').getByLabel('Name *').fill('Hand wash')
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    ok('an entry is added', await visible(page.getByRole('cell', { name: 'Hand wash' })))
    await page.screenshot({ path: `${SHOTS}/catalog-6-entries.png` })

    ok('no page errors', errors.length === 0, errors)
  } finally {
    for (const undo of cleanup.reverse()) await undo()
    await browser.close()
  }
  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  process.exitCode = failures.length ? 1 : 0
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
