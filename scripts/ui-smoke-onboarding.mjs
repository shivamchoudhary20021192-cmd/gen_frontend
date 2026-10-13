/**
 * A new merchant, from nothing to a live-looking store.
 *
 *   ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 STORE_URL_TEMPLATE=http://{handle}.localhost:4100 PW_CHANNEL=chrome node scripts/ui-smoke-onboarding.mjs
 *
 * Walks the onboarding one screen at a time — what describes you, where you
 * will sell, what you sell, a theme and a style, the store's name, the
 * account — and checks that the store it opens has the theme and style that
 * were picked, and that its storefront renders with them.
 *
 * Creates a real store (and identity) each run; run it against a scratch
 * database.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.ADMIN_URL ?? 'http://localhost:5176'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4100'
const STORE = process.env.STORE_URL_TEMPLATE ?? 'http://{handle}.localhost:4100'
const SHOTS = process.env.SHOTS_DIR ?? 'screenshots'
const run = Date.now().toString(36)
const email = `onboarding-${run}@example.com`
const password = `Smoke!${run}Aa1`
const storeName = `Maison ${run}`

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

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const next = () => page.getByRole('button', { name: 'Next', exact: true }).click()

  try {
    process.stdout.write('\nOnboarding\n')
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
    await page.getByText('Which of these best describes you?').waitFor({ timeout: 20000 })
    await page.getByText("I'm just starting").click()
    await page.screenshot({ path: `${SHOTS}/onboarding-1-describe.png` })
    await next()
    await page.getByText('Where would you like to sell?').waitFor()
    await page.getByText('An online store', { exact: true }).click()
    await page.getByText('Social media', { exact: true }).click()
    await next()
    await page.getByText('What do you plan to sell?').waitFor()
    await page.getByText('Fashion & apparel', { exact: true }).click()
    await next()
    await page.getByText('Pick a look for your store').waitFor()
    ok('recommends the theme made for what the store sells', (await page.getByText('Recommended').count()) === 1)
    await page.getByLabel('Atelier, Sand style').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/onboarding-2-look.png`, fullPage: true })
    await next()
    await page.getByText('Name your store').waitFor()
    await page.getByLabel('Store name').fill(storeName)
    await page.waitForTimeout(1200)
    const handle = await page.getByLabel('Store address').inputValue()
    ok('suggests a store address from the name', handle.length > 3, handle)
    await next()
    await page.getByText('Create your account').waitFor()
    await page.getByLabel('First name').fill('Onboarding')
    await page.getByLabel('Last name').fill('Smoke')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.screenshot({ path: `${SHOTS}/onboarding-3-account.png` })
    await page.getByRole('button', { name: 'Create store' }).click()
    await page.getByText('Setting up').first().waitFor({ timeout: 10000 })
    await page.waitForURL(/\/dashboard/, { timeout: 90000 })
    ok('lands in the new store’s admin', true)
    await page.getByText(/is ready/).first().waitFor({ timeout: 20000 })
    ok('the dashboard welcomes the new store', true)
    await page.screenshot({ path: `${SHOTS}/onboarding-4-dashboard.png` })

    // What was built.
    const login = await (await fetch(`${API}/admin/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
    const bearer = login.access_token ?? login.tokens?.access_token
    const themes = await (await fetch(`${API}/admin/api/v1/themes`, { headers: { Authorization: `Bearer ${bearer}` } })).json()
    const live = themes.themes?.find((theme) => theme.role === 'main')
    ok('the store runs the theme that was picked', live?.theme === 'atelier', themes)
    ok('in the style that was picked', live?.preset === 'Sand', live)

    const storefront = STORE.replace('{handle}', handle)
    const response = await page.goto(`${storefront}/`, { waitUntil: 'networkidle' })
    ok('its storefront opens', response?.status() === 200 || response?.status() === 302, response?.status())
    // A new store is password-protected until launch: the password page is the theme's own.
    const body = await page.content()
    ok('the storefront is rendered by its theme', body.includes('theme-style.css') || body.includes('shopify-section'), body.slice(0, 200))
    await page.screenshot({ path: `${SHOTS}/onboarding-5-storefront.png`, fullPage: true })
  } catch (error) {
    failures.push(String(error))
    process.stdout.write(`  ✗ ${String(error).split('\n')[0]}\n`)
    await page.screenshot({ path: `${SHOTS}/onboarding-failure.png` }).catch(() => undefined)
  } finally {
    await browser.close()
  }
  if (errors.length) process.stdout.write(`\nPage errors:\n  ${errors.join('\n  ')}\n`)
  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  process.exit(failures.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
