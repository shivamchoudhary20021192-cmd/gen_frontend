/**
 * Browser smoke test for the Online Store's settings beyond the theme, and
 * for a shopper's side of them:
 *
 *   Settings → Customer accounts, Languages (add, publish, translate), Audit log, Taxes
 *   Settings → Apps → a custom app's theme extension
 *   The theme editor: app embeds, app blocks, the customer account templates
 *   The theme store's screenshots, and the operators' audit log
 *   The storefront: signing in with a code, the account page, a translated page
 *
 *   ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 STOREFRONT=http://veylor.localhost:4100 \
 *   PW_CHANNEL=chrome SHOTS_DIR=… node scripts/ui-smoke-online-store.mjs
 *
 * Reads the one-time code from the backend's database (as the messaging log
 * keeps it in development), so it needs BACKEND_DIR (default ../veylog-backend)
 * for its .env and mysql2.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const BASE = process.env.ADMIN_URL ?? 'http://localhost:5176'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4100'
const STOREFRONT = process.env.STOREFRONT ?? 'http://veylor.localhost:4100'
const SHOTS = process.env.SHOTS_DIR ?? 'screenshots'
const BACKEND = path.resolve(process.env.BACKEND_DIR ?? '../veylog-backend')
const requireBackend = createRequire(path.join(BACKEND, 'package.json'))
requireBackend('dotenv').config({ path: path.join(BACKEND, '.env') })
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const DB_NAME = process.env.SMOKE_DB ?? 'veylog_upgrade'

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

async function login() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  const body = await response.json()
  if (!response.ok) throw new Error(`login → ${response.status}`)
  return { access: body.access_token ?? body.tokens?.access_token, refresh: body.refresh_token ?? body.tokens?.refresh_token }
}

async function api(bearer, route, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}/admin/api/v1${route}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

/**
 * The storefront from Node. *.localhost resolves only in browsers, and fetch
 * will not send another Host, so this asks 127.0.0.1 over node:http with the
 * store's Host header. Redirects are not followed.
 */
function storefront(route) {
  const url = new URL(STOREFRONT)
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: Number(url.port || 80), path: route, headers: { Host: url.host } }, (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location ?? null, text: body }))
      })
      .on('error', reject)
  })
}

/** A scratch database only: lets the test number ask for codes again (5 an hour is the real limit). */
async function resetCodeThrottle(phone) {
  const mysql = requireBackend('mysql2/promise')
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: DB_NAME })
  try {
    await connection.query('DELETE FROM otp_throttle WHERE identifier LIKE ?', [`%${phone}`])
    await connection.query("DELETE FROM rate_limits WHERE bucket_key LIKE 'shop.account%' OR bucket_key LIKE 'shop.otp%'")
  } finally {
    await connection.end()
  }
}

async function latestCode() {
  const mysql = requireBackend('mysql2/promise')
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: DB_NAME })
  try {
    const [rows] = await connection.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload, '$.variables.otp')) AS otp FROM notification_logs WHERE event_key = 'otp.login' ORDER BY id DESC LIMIT 1")
    return rows[0]?.otp ?? null
  } finally {
    await connection.end()
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const tokens = await login()
  const bearer = tokens.access
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addInitScript(([access, refresh]) => {
    localStorage.setItem('veylog.access_token', access)
    localStorage.setItem('veylog.refresh_token', refresh)
  }, [tokens.access, tokens.refresh])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))

  try {
    // ── customer accounts ──────────────────────────────────────────────────
    process.stdout.write('\nSettings → Customer accounts\n')
    // Start from accounts on, whatever an interrupted run left behind.
    await api(bearer, '/online-store/preferences', { method: 'PUT', body: { customer_accounts: 'optional' } })
    await page.goto(`${BASE}/settings/customer-accounts`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Sign-in links', { exact: true }).waitFor({ timeout: 60000 })
    ok('shows the sign-in setting, on', await page.getByRole('radio', { name: /Show sign-in links/ }).isChecked())
    await page.getByRole('radio', { name: /Don’t use customer accounts/ }).check()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Customer accounts are off').waitFor({ timeout: 10000 })
    const off = await storefront('/account/login')
    ok('turning accounts off takes /account away from the store', off.status === 302, off.status)
    await page.getByRole('radio', { name: /Show sign-in links/ }).check()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Customer accounts are on').waitFor({ timeout: 10000 })
    await page.screenshot({ path: `${SHOTS}/os-1-customer-accounts.png`, fullPage: true })

    // ── the shopper signs in ───────────────────────────────────────────────
    process.stdout.write('\nStorefront → signing in\n')
    await resetCodeThrottle('9876543210')
    const shopper = await context.newPage()
    await shopper.waitForTimeout(16000) // the preference is cached for 15 seconds
    await shopper.goto(`${STOREFRONT}/account/login`, { waitUntil: 'load', timeout: 90000 })
    await shopper.getByLabel('Mobile number').fill('9876543210')
    await shopper.getByRole('button', { name: 'Continue' }).click()
    await shopper.getByText('Enter your code').waitFor({ timeout: 10000 })
    ok('asks for the code it sent', await shopper.getByText(/We sent a code to/).isVisible())
    const code = await latestCode()
    await shopper.getByLabel('Code').fill(code ?? '')
    await shopper.getByRole('button', { name: 'Sign in' }).click()
    await shopper.waitForURL(/\/account$/, { timeout: 15000 })
    ok('signs in and lands on the account page', await shopper.getByRole('heading', { name: 'Account', exact: true, level: 1 }).isVisible())
    ok('lists their orders', (await shopper.locator('.order-card').count()) > 0)
    await shopper.screenshot({ path: `${SHOTS}/os-2-storefront-account.png`, fullPage: true })
    await shopper.locator('.order-card__link').first().click()
    await shopper.getByText('Progress').waitFor({ timeout: 10000 })
    ok('opens an order with its progress and totals', await shopper.locator('.order-totals__total').isVisible())
    await shopper.screenshot({ path: `${SHOTS}/os-3-storefront-order.png`, fullPage: true })
    await shopper.goto(`${STOREFRONT}/account/addresses`, { waitUntil: 'load', timeout: 90000 })
    ok('shows the address book', await shopper.getByRole('heading', { name: 'Addresses', exact: true, level: 1 }).isVisible())
    await shopper.close()

    // ── languages and translation ──────────────────────────────────────────
    process.stdout.write('\nSettings → Languages\n')
    await api(bearer, '/online-store/languages/fr', { method: 'DELETE' })
    await page.goto(`${BASE}/settings/languages`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Store languages').waitFor({ timeout: 20000 })
    ok('lists the store languages', await page.getByRole('row', { name: /English/ }).waitFor({ timeout: 10000 }).then(() => true, () => false))
    await page.getByRole('button', { name: 'Add language' }).click()
    await page.getByRole('dialog').getByLabel('Language').fill('French')
    await page.getByRole('option', { name: /French/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click()
    await page.getByText(/French added/).waitFor({ timeout: 10000 })
    const frenchRow = page.getByRole('row', { name: /French/ })
    ok('adds a language, unpublished', await frenchRow.getByText('Unpublished', { exact: true }).waitFor({ timeout: 5000 }).then(() => true, () => false))
    await frenchRow.getByRole('button', { name: 'More actions for French' }).click()
    await page.getByRole('menuitem', { name: 'Publish' }).click()
    await page.getByText('French is live on your store').waitFor({ timeout: 10000 })
    ok('publishes it', await frenchRow.getByText('Published').isVisible())
    await page.screenshot({ path: `${SHOTS}/os-4-languages.png`, fullPage: true })

    await page.getByRole('menu').waitFor({ state: 'hidden' }).catch(() => undefined)
    await frenchRow.getByRole('link', { name: 'Translate' }).click()
    await page.getByText('Translate into French').waitFor({ timeout: 20000 })
    const titleInput = page.getByPlaceholder('Leave empty to show the original').first()
    // Unique per run: translations outlive a removed language, so a fixed text would already be saved.
    const frenchTitle = `Sérum de test ${Date.now().toString(36)}`
    await titleInput.fill(frenchTitle)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Translation saved').waitFor({ timeout: 10000 })
    await page.screenshot({ path: `${SHOTS}/os-5-translate.png`, fullPage: true })
    const translated = await api(bearer, '/online-store/translations/fr/product?limit=1')
    const handle = translated.body.resources?.[0]?.subtitle
    const french = (await storefront(`/fr/products/${handle}`)).text
    ok('the storefront shows the translation under /fr/', french.includes(frenchTitle) && french.includes('lang="fr"'), handle)
    ok('with the theme’s own French words', french.includes('Ajouter au panier'))
    await page.getByRole('tab', { name: 'Theme content' }).click()
    await page.getByText(/header \(all pages\)|footer \(all pages\)/).first().waitFor({ timeout: 10000 })
    ok('lists the theme’s own text to translate', (await page.getByText('(all pages)').count()) > 0)
    await api(bearer, '/online-store/languages/fr', { method: 'DELETE' })

    // ── theme editor: app embeds, app blocks, account templates ────────────
    process.stdout.write('\nTheme editor\n')
    const live = (await api(bearer, '/themes')).body.themes.find((theme) => theme.role === 'main')
    await page.goto(`${BASE}/merchandising/themes/${live.id}?template=product`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Template', { exact: true }).waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: 'Theme settings' }).click()
    await page.getByText('App embeds').waitFor({ timeout: 10000 })
    ok('shows the installed apps’ embeds', await page.getByText('WhatsApp chat button').isVisible())
    ok('with the chat button switched on', await page.getByRole('switch', { name: /WhatsApp chat button/ }).isChecked().catch(() => page.getByRole('checkbox', { name: /WhatsApp chat button/ }).isChecked()))
    await page.screenshot({ path: `${SHOTS}/os-6-app-embeds.png` })
    await page.getByRole('button', { name: 'Sections' }).click()
    const productSection = page.getByText(/^Product information$|^Product$/).first()
    await productSection.click()
    await page.getByRole('button', { name: 'Add block' }).first().click()
    ok('offers app blocks where a section accepts them', await page.getByRole('menuitem', { name: /Trust badges/ }).isVisible())
    await page.keyboard.press('Escape')

    await page.goto(`${BASE}/merchandising/themes/${live.id}?template=customers/account`, { waitUntil: 'load', timeout: 90000 })
    const preview = page.frameLocator('iframe[title="Store preview"]')
    await preview.getByText('Asha Rao').first().waitFor({ timeout: 30000 })
    ok('the account template previews with a sample customer', true)
    await page.screenshot({ path: `${SHOTS}/os-7-editor-account.png` })

    // ── the theme store's screenshots ──────────────────────────────────────
    process.stdout.write('\nTheme store\n')
    await page.goto(`${BASE}/merchandising/themes`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Free themes').scrollIntoViewIfNeeded()
    const shot = page.locator('img[alt^="Atelier ·"]').first()
    await shot.waitFor({ timeout: 15000 })
    ok('cards show real screenshots', await shot.evaluate((image) => image.complete && image.naturalWidth > 0))
    await page.getByText('Atelier', { exact: true }).last().click()
    ok('the listing shows the phone view too', await page.getByRole('dialog').locator('img[alt="Atelier on a phone"]').isVisible())
    await page.screenshot({ path: `${SHOTS}/os-8-theme-store.png` })
    await page.getByRole('button', { name: 'Close' }).click()

    // ── apps: the theme extension ──────────────────────────────────────────
    process.stdout.write('\nSettings → Apps\n')
    await page.goto(`${BASE}/settings/apps`, { waitUntil: 'load', timeout: 90000 })
    await page.getByRole('tab', { name: /Develop/ }).click()
    await page.getByRole('button', { name: 'Theme extension' }).first().click()
    await page.getByRole('dialog').getByText(/Deployed · version/).waitFor({ timeout: 10000 })
    ok('shows the deployed extension and its blocks', await page.getByRole('dialog').getByText('Trust badges').isVisible())
    await page.screenshot({ path: `${SHOTS}/os-9-extension.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

    // ── taxes, audit ───────────────────────────────────────────────────────
    process.stdout.write('\nTaxes and the audit log\n')
    await page.goto(`${BASE}/settings/taxes`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Charge tax on delivery').waitFor({ timeout: 20000 })
    ok('taxes offer the delivery switch', true)
    await page.goto(`${BASE}/settings/audit`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('What happened').waitFor({ timeout: 20000 })
    ok('the audit log lists what happened', await page.locator('tbody tr').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
    await page.locator('tbody tr').first().click()
    ok('and opens an entry', await page.getByRole('dialog').getByText('When').isVisible())
    await page.screenshot({ path: `${SHOTS}/os-10-audit.png` })
    await page.keyboard.press('Escape')
    await page.goto(`${BASE}/console/audit`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Every store, newest first.').waitFor({ timeout: 20000 })
    ok('operators see every store’s trail', await page.locator('tbody tr').first().waitFor({ timeout: 15000 }).then(() => true, () => false))

    ok('no page errors', errors.length === 0, errors)
  } catch (error) {
    failures.push(String(error))
    // Playwright's call log says what the action was waiting for.
    process.stdout.write(`  ✗ ${String(error).split('\n').slice(0, 14).join('\n    ')}\n`)
    await page.screenshot({ path: `${SHOTS}/os-failure.png` }).catch(() => undefined)
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
