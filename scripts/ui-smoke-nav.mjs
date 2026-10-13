/**
 * Headless click-through of the DB-driven menu and the discounts module.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-nav.mjs
 *
 * Covers the three claims this phase makes: the sidebar is built from
 * /menu-navigation rather than a hardcoded array, items whose screens do not
 * exist render disabled instead of as dead links, and a discount created on the
 * Discounts page can be attached from the product form.
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

  // Watch the network so "the menu came from the server" is proven, not assumed.
  let menuResponse = null
  page.on('response', async (response) => {
    if (response.url().includes('/menu-navigation') && response.status() === 200) {
      menuResponse = await response.json().catch(() => null)
    }
  })

  console.log('\nVeylog admin UI — navigation + discounts\n')

  console.log('Login')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1200)

  // ── the menu is server-driven ──────────────────────────────────────────────
  console.log('\nSidebar')
  ok('GET /menu-navigation was called on load', menuResponse !== null)
  const sections = menuResponse?.sections ?? []
  ok('response is grouped into sections', sections.length >= 5, `${sections.length} sections`)
  const flat = menuResponse?.flat ?? []
  ok('response carries the full route table', flat.length >= 40, `${flat.length} rows`)

  const sectionHeadings = sections.map((s) => s.section)
  for (const heading of ['Commerce', 'Marketing', 'Content', 'Settings']) {
    ok(
      `sidebar renders the "${heading}" section`,
      await page.getByText(heading, { exact: true }).first().isVisible().catch(() => false),
    )
  }
  ok('sections match the API payload', sectionHeadings.includes('Commerce'), sectionHeadings.join(', '))

  // Items the API marks coming_soon must not be links.
  const soonChips = await page.getByText('Soon', { exact: true }).count()
  ok('unbuilt screens are flagged rather than linked', soonChips > 0, `${soonChips} "Soon" chips`)
  // Orders is NOT the example to use here: it has a route and a live badge, so
  // it is an anchor by design. Pick a row the API actually marks coming_soon.
  const soonRow = page.getByRole('navigation').getByText('Soon', { exact: true }).first()
  const soonLabel = await soonRow
    .locator('xpath=ancestor::*[self::a or self::div][1]')
    .innerText()
    .catch(() => '')
  ok('a coming-soon item is not an anchor', (await soonRow.locator('xpath=ancestor::a').count()) === 0, soonLabel.replace(/\n+/g, ' '))

  // and the routed groups are reachable, not just expandable
  for (const label of ['Orders', 'Products']) {
    const href = await page
      .getByRole('navigation')
      // The accessible name carries the badge too ("99+ Orders"), so anchor
      // only the tail.
      .getByRole('link', { name: new RegExp(`${label}$`) })
      .first()
      .getAttribute('href')
      .catch(() => null)
    // endsWith: the built bundle serves under /admin/, so the href is
    // /admin/orders there and /orders on the dev server.
    ok(
      `${label} is a link, not only a group toggle`,
      (href ?? '').endsWith(`/${label.toLowerCase()}`),
      String(href),
    )
  }

  // ── discounts: create ──────────────────────────────────────────────────────
  console.log('\nDiscounts')
  await clickNav(page, 'Discounts')
  await page.waitForURL('**/discounts')
  await page.waitForTimeout(1000)
  ok('discounts page opens from the sidebar', page.url().endsWith('/discounts'))

  const code = `UISMOKE${Date.now().toString(36).toUpperCase().slice(-5)}`
  await page.getByRole('button', { name: /Create/ }).first().click()
  await page.waitForURL('**/discounts/new')
  await page.getByLabel('Discount code').fill(code)
  await page.getByLabel('Internal title').fill('UI smoke discount')

  const valueField = page.getByLabel('Value', { exact: true })
  await valueField.fill('150')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(1500)
  const overHundred = await page
    .getByText(/cannot exceed 100/i)
    .first()
    .isVisible()
    .catch(() => false)
  ok('a 150% discount is rejected with the API message', overHundred)

  await valueField.fill('20')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  // The form deliberately returns to the list after a create, so that — not a
  // detail route — is what a successful save looks like.
  await page.waitForURL(/\/discounts$/, { timeout: 15000 })
  ok('saving creates the discount and returns to the list', /\/discounts$/.test(page.url()), page.url())
  await page.waitForTimeout(1200)
  ok('the new discount appears in the list', await page.getByText(code).first().isVisible())

  // ── discounts: attach from the product form ────────────────────────────────
  console.log('\nProduct → discount dropdown')
  await clickNav(page, 'Products')
  await page.waitForURL('**/products')
  await page.waitForTimeout(1200)
  await page.locator('table tbody tr').first().click()
  await page.waitForURL(/\/products\/\d+$/, { timeout: 15000 })
  await page.waitForTimeout(1500)

  const attach = page.getByLabel('Attach discounts')
  ok('the product form shows the discounts dropdown', await attach.isVisible().catch(() => false))

  await attach.click()
  await page.waitForTimeout(600)
  const option = page.getByRole('option', { name: new RegExp(code) })
  ok('the new discount is offered in the dropdown', (await option.count()) > 0)
  await option.first().click()
  await page.waitForTimeout(1800)

  const chip = page.locator('.MuiChip-label', { hasText: code })
  ok('selecting it attaches the discount', await chip.first().isVisible().catch(() => false))

  // Waited for, not slept through. Attaching fires a request the screen does
  // not block on, and a reload that lands first throws the write away — which
  // made this assertion fail about half the time and say nothing useful when
  // it did.
  await page
    .waitForResponse(
      (response) =>
        /\/admin\/api\/v1\/products\/\d+/.test(response.url()) &&
        ['POST', 'PUT', 'PATCH'].includes(response.request().method()),
      { timeout: 10000 },
    )
    .catch(() => undefined)
  await page.waitForTimeout(600)

  await page.reload({ waitUntil: 'networkidle' })
  // Waited for, not slept through — again. A fixed pause makes this assertion
  // a measure of how fast the machine is rather than of whether the write
  // happened, and it failed on a loaded machine while the row was in the
  // database the whole time.
  const persisted = await page
    .locator('.MuiChip-label', { hasText: code })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  ok('the attachment survives a reload (it was written, not just rendered)', persisted)

  // ── menu editor ────────────────────────────────────────────────────────────
  console.log('\nNavigation settings')
  await page.goto(`${BASE}/settings/navigation`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const menuRows = await page.locator('table tbody tr').count()
  ok('the editor lists every menu row', menuRows >= 40, `${menuRows} rows`)

  await page.locator('table tbody tr').first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  ok('clicking a row opens the editor dialog', await dialog.isVisible())

  const titleField = dialog.getByRole('textbox', { name: 'Title', exact: true })
  const originalTitle = await titleField.inputValue()
  await titleField.fill(`${originalTitle} ✓`)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 10000 })
  await page.waitForTimeout(1200)
  ok(
    'renaming an item updates the sidebar immediately',
    await page.getByText(`${originalTitle} ✓`).first().isVisible().catch(() => false),
  )

  // Put it back so reruns start from the seeded state.
  await page.locator('table tbody tr').first().click()
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(originalTitle)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 10000 })
  await page.waitForTimeout(800)
  ok('the rename can be reverted', await page.getByText(originalTitle).first().isVisible())

  await page.screenshot({ path: '/tmp/ui-menu-settings.png', fullPage: false })

  console.log('\nConsole')
  const meaningful = consoleErrors.filter(
    (t) => !t.includes('Download the React DevTools') && !t.includes('favicon') && !t.includes('422'),
  )
  ok('no unexpected console errors', meaningful.length === 0, meaningful.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n${'='.repeat(48)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  if (failures.length) console.log(`\n  Failed:\n${failures.map((f) => `    - ${f}`).join('\n')}`)
  console.log(`${'='.repeat(48)}\n`)
  writeFileSync('/tmp/ui-smoke-nav-result.json', JSON.stringify({ passed, failed, failures }, null, 2))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nNav smoke crashed:', error)
  process.exit(1)
})
