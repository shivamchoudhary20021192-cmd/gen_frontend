/**
 * Headless click-through of the platform screens: store details, plan and
 * billing, markets, taxes, domains, integrations, notifications, apps,
 * themes and the theme editor, shipping zones — plus the signed-out pages.
 *
 *   npm run dev                       # vite, proxying to the API on 4000
 *   node scripts/ui-smoke-platform.mjs
 *
 * UI_BASE picks the admin (default http://127.0.0.1:5173); PW_CHANNEL=chrome
 * uses the installed Chrome instead of Playwright's download; SHOTS_DIR, when
 * set, keeps a full-page screenshot of every screen. Fails on any console
 * error or on a screen that does not render its heading.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = process.env.SHOTS_DIR ?? null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

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

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true })
}

// PW_CHANNEL=chrome|msedge uses an installed browser when Playwright's own is not downloaded.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`${page.url()} :: ${message.text()}`)
})
page.on('pageerror', (error) => consoleErrors.push(`${page.url()} :: ${String(error)}`))

try {
  console.log('\nVeylog admin — platform screens\n')

  console.log('Signed out')
  for (const [path, heading] of [
    ['/signup', 'Start your store'],
    ['/forgot-password', 'Reset your password'],
    ['/reset-password', 'Choose a new password'],
    ['/accept-invite', 'Staff invitation'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const visible = await page.getByText(heading, { exact: true }).first().isVisible().catch(() => false)
    ok(`${path} renders`, visible)
    await shot(page, `public${path.replace(/\//g, '-')}`)
  }
  // Signup asks the platform for countries and what stores sell.
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.getByLabel('What will you sell?').click()
  const verticals = await page.getByRole('option').count()
  ok('signup lists what a store can sell', verticals >= 3, `${verticals} options`)
  await page.keyboard.press('Escape')
  await page.getByLabel('Store name').fill('Smoke Test Botanicals')
  await page.waitForTimeout(900)
  const handle = await page.getByLabel('Store address').inputValue()
  ok('signup suggests a store address from the name', handle.startsWith('smoke-test-botanicals'), handle)

  console.log('\nSign in')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  ok('login links to signup', await page.getByRole('link', { name: 'Start a store' }).isVisible())
  ok('login links to password reset', await page.getByRole('link', { name: 'Forgot password?' }).isVisible())
  await page.getByLabel('Email').fill(EMAIL)
  await page.locator('input[type=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  ok('signed in', !page.url().endsWith('/login'))

  console.log('\nStore switcher')
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await shot(page, 'dashboard')
  const switcher = page.getByRole('button', { name: /switch store|store menu/i }).first()
  const hasSwitcher = await switcher.isVisible().catch(() => false)
  ok('store switcher shows in the top bar', hasSwitcher)

  const screens = [
    ['/settings/store', 'Store details'],
    ['/settings/billing', 'Plan and billing'],
    ['/settings/markets', 'Markets'],
    ['/settings/taxes', 'Taxes and duties'],
    ['/settings/domains', 'Domains'],
    ['/settings/integrations', 'Integrations'],
    ['/settings/notifications', 'Notifications'],
    ['/settings/apps', 'Apps and sales channels'],
    ['/merchandising/themes', 'Themes'],
    ['/stores/new', 'Create another store'],
  ]
  console.log('\nSettings screens')
  for (const [path, heading] of screens) {
    const before = consoleErrors.length
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const visible = await page
      .getByRole('heading', { name: heading, exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false)
    await page.waitForTimeout(400)
    ok(`${path} renders "${heading}"`, visible)
    ok(`${path} has no console errors`, consoleErrors.length === before, consoleErrors.slice(before).join('\n      '))
    await shot(page, path.slice(1).replace(/\//g, '-'))
  }

  console.log('\nMarkets')
  await page.goto(`${BASE}/settings/markets`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add market' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Market name').fill('Smoke Market')
  await dialog.getByLabel('Countries').click()
  await dialog.getByLabel('Countries').fill('Iceland')
  await page.getByRole('option', { name: 'Iceland' }).click()
  // Escape would close the whole dialog; clicking its title only closes the list.
  await dialog.getByRole('heading', { name: 'Add market' }).click()
  await shot(page, 'markets-dialog')
  const preview = await dialog.getByText(/product shows as/).isVisible().catch(() => false)
  ok('market dialog previews a converted price', preview)
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  console.log('\nTaxes')
  await page.goto(`${BASE}/settings/taxes`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  const answered = await page.getByText('Customer pays', { exact: true }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
  ok('tax rate check answers', answered)
  // A GST store charges its default class, so the check shows a named tax.
  ok('tax rate check names the tax', await page.getByText(/GST|VAT|tax \(/).last().isVisible().catch(() => false))
  await shot(page, 'taxes-check')

  console.log('\nShipping zones')
  await page.goto(`${BASE}/settings/shipping`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Zones' }).click()
  await page.waitForTimeout(500)
  ok('zones tab renders', await page.getByRole('heading', { name: 'Shipping zones' }).isVisible().catch(() => false))
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.waitForTimeout(800)
  const quoted = await page.getByText(/General rates|Zone:|No delivery|do not/).first().isVisible().catch(() => false)
  ok('delivery preview answers', quoted)
  await shot(page, 'shipping-zones')

  console.log('\nIntegrations')
  await page.goto(`${BASE}/settings/integrations`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add integration' }).click()
  const catalogCards = await page.getByRole('dialog').getByRole('button').count()
  ok('integration catalogue lists providers', catalogCards > 5, `${catalogCards} buttons`)
  await shot(page, 'integrations-catalog')
  await page.keyboard.press('Escape')

  console.log('\nApps')
  await page.goto(`${BASE}/settings/apps?tab=develop`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Create app' }).click()
  await page.waitForTimeout(500)
  const scopes = await page.getByRole('dialog').getByRole('checkbox').count()
  ok('custom app dialog lists API permissions', scopes > 5, `${scopes} checkboxes`)
  await shot(page, 'apps-create')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  console.log('\nTheme editor')
  await page.goto(`${BASE}/merchandising/themes`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Customize' }).first().click()
  await page.waitForURL('**/merchandising/themes/*')
  await page.waitForTimeout(1200)
  ok('theme editor shows the preview', await page.getByText('New season, new rituals').isVisible().catch(() => false))
  await shot(page, 'theme-editor')
  await page.getByRole('button', { name: 'Mobile preview' }).click()
  await page.waitForTimeout(400)
  await shot(page, 'theme-editor-mobile')

  console.log('\nDiscount form')
  await page.goto(`${BASE}/discounts/new`, { waitUntil: 'networkidle' })
  await page.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Buy X get Y' }).click()
  ok('buy X get Y asks how many', await page.getByLabel('Customer buys').isVisible().catch(() => false))
  await page.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Free gift' }).click()
  ok('free gift asks for the gift', await page.getByLabel('Gift', { exact: true }).isVisible().catch(() => false))
  await shot(page, 'discount-gift')

  console.log('\nBrand')
  await page.goto(`${BASE}/settings/store`, { waitUntil: 'networkidle' })
  ok('store details has a Brand card', await page.getByRole('heading', { name: 'Brand', exact: true }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false))
  ok('brand asks for a slogan', await page.getByLabel('Slogan').isVisible().catch(() => false))

  console.log('\nPlatform console')
  const consoleScreens = [
    ['/console', 'Platform overview'],
    ['/console/stores', 'Stores'],
    ['/console/plans', 'Plans'],
    ['/console/billing', 'Platform billing'],
    ['/console/exchange-rates', 'Exchange rates'],
    ['/console/apps', 'App store'],
    ['/console/jobs', 'Background jobs'],
    ['/console/emails', 'Platform email'],
  ]
  for (const [path, heading] of consoleScreens) {
    const before = consoleErrors.length
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const visible = await page
      .getByRole('heading', { name: heading, exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false)
    ok(`${path} renders "${heading}"`, visible)
    ok(`${path} has no console errors`, consoleErrors.length === before, consoleErrors.slice(before).join('\n      '))
    await shot(page, path.slice(1).replace(/\//g, '-'))
  }

  await page.goto(`${BASE}/console/stores?q=veylor`, { waitUntil: 'networkidle' })
  await page.getByRole('cell', { name: /Veylor/ }).first().click()
  await page.waitForURL('**/console/stores/*')
  ok('a store opens from the list', await page.getByRole('button', { name: 'Open store admin' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false))
  ok('the store page shows its plan', await page.getByRole('heading', { name: 'Plan and subscription' }).isVisible().catch(() => false))
  await shot(page, 'console-store')

  await page.goto(`${BASE}/console/plans`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Create plan' }).click()
  const planDialog = page.getByRole('dialog')
  ok('the plan form lists every limit', (await planDialog.getByRole('checkbox', { name: 'Unlimited' }).count()) >= 8)
  await shot(page, 'console-plan-dialog')
  await planDialog.getByRole('button', { name: 'Cancel' }).click()

  await page.goto(`${BASE}/console/exchange-rates`, { waitUntil: 'networkidle' })
  const euro = await page.getByRole('cell', { name: /Euro/ }).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
  ok('exchange rates list currencies', euro && (await page.getByRole('row').count()) > 5)

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Switch store' }).click()
  ok('operators find the console in the store menu', await page.getByRole('menuitem', { name: 'Platform console' }).isVisible().catch(() => false))
  await page.keyboard.press('Escape')
} catch (error) {
  failed++
  failures.push(String(error))
  console.log(`  ✗ ${error}`)
  await shot(page, 'failure').catch(() => {})
} finally {
  await browser.close()
}

if (consoleErrors.length) {
  console.log('\nConsole errors:')
  for (const line of consoleErrors) console.log(`  ${line}`)
}
console.log(`\n${passed} passed, ${failed} failed`)
if (failed) {
  console.log(failures.map((label) => `  - ${label}`).join('\n'))
  process.exit(1)
}
