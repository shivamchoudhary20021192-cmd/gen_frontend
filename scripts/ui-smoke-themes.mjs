/**
 * Online Store → Themes, the theme editor and the code editor.
 *
 *   ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 PW_CHANNEL=chrome node scripts/ui-smoke-themes.mjs
 *
 * Proves a merchant can work the screens end to end: the theme list and the
 * theme store render; the editor shows the page's sections beside the real
 * store; editing a block's text changes the preview without a reload; adding
 * a section puts it on the page; Save makes it the theme's file; the code
 * editor opens files and refuses Liquid that does not parse.
 *
 * Whatever it changes on the live theme it puts back, and asserts it did.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.ADMIN_URL ?? 'http://localhost:5176'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4100'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = process.env.SHOTS_DIR ?? 'screenshots'

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

async function api(bearer, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}/admin/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const tokens = await login()
  const bearer = tokens.access
  const list = await api(bearer, '/themes')
  const live = list.body.themes.find((theme) => theme.role === 'main')
  ok('a live theme exists', Boolean(live), list.body)
  const original = await api(bearer, `/themes/${live.id}/files/content?path=${encodeURIComponent('templates/index.json')}`)
  const originalIndex = original.body.file.content

  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
  await context.addInitScript(([access, refresh]) => {
    localStorage.setItem('veylog.access_token', access)
    localStorage.setItem('veylog.refresh_token', refresh)
  }, [tokens.access, tokens.refresh])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))

  try {
    // ── the themes page ────────────────────────────────────────────────────
    process.stdout.write('\nThemes page\n')
    await page.goto(`${BASE}/merchandising/themes`, { waitUntil: 'networkidle' })
    await page.getByText('Current theme').waitFor({ timeout: 20000 })
    ok('shows the current theme', await page.getByText(live.name, { exact: true }).first().isVisible())
    ok('lists the theme library', (await page.getByRole('button', { name: 'Publish' }).count()) >= 1)
    await page.getByText('Free themes').scrollIntoViewIfNeeded()
    ok('shows the free themes', (await page.getByText('Atelier', { exact: true }).count()) >= 1)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/themes-1-list.png`, fullPage: true })
    await page.getByText('Atelier', { exact: true }).last().click()
    await page.getByRole('dialog').getByText('Features').waitFor()
    ok('opens a theme store listing with its features', await page.getByRole('dialog').getByText('Lookbook with hotspots').isVisible())
    await page.screenshot({ path: `${SHOTS}/themes-2-store-dialog.png` })
    await page.getByRole('button', { name: 'Close' }).click()

    // ── the theme editor ───────────────────────────────────────────────────
    process.stdout.write('\nTheme editor\n')
    await page.goto(`${BASE}/merchandising/themes/${live.id}`, { waitUntil: 'networkidle' })
    await page.getByText('Template', { exact: true }).waitFor({ timeout: 20000 })
    const preview = page.frameLocator('iframe[title="Store preview"]')
    await preview.locator('.shopify-section').first().waitFor({ timeout: 30000 })
    ok('the preview is the real store', (await preview.locator('[data-shopify-editor-section]').count()) > 3)
    ok('shows the header, template and footer groups', (await page.getByText('Header', { exact: true }).count()) > 0 && (await page.getByText('Footer', { exact: true }).count()) > 0)

    // Select the hero's heading block and change it.
    await page.getByText('Image banner', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Expand' }).first().waitFor()
    const heroRow = page.locator('text=Image banner').first()
    await heroRow.click()
    const settingsPane = page.locator('text=Image height').first()
    ok('selecting a section shows its schema settings', await page.getByText('Banner height').isVisible().catch(() => false) || (await settingsPane.count()) > 0)
    const headingBlock = page.getByText(/Skincare that explains itself|Made for everyday|The new collection|Performance, delivered/).first()
    await headingBlock.click()
    const input = page.getByLabel('Heading', { exact: true })
    await input.fill('Smoke-tested heading')
    await preview.getByText('Smoke-tested heading').waitFor({ timeout: 15000 })
    ok('editing a block updates the preview in place', true)
    await page.screenshot({ path: `${SHOTS}/themes-3-editor.png` })

    // Add a section.
    await page.getByRole('button', { name: 'Add section' }).nth(1).click()
    await page.getByRole('dialog').getByText('Rich text', { exact: true }).click()
    await preview.getByText('Talk about your brand').waitFor({ timeout: 20000 })
    ok('adding a section puts it on the page', true)

    // Theme settings panel.
    await page.getByRole('button', { name: 'Theme settings' }).click()
    ok('theme settings list the schema groups', await page.getByText('Typography', { exact: true }).isVisible())
    await page.getByText('Colors', { exact: true }).click()
    await page.screenshot({ path: `${SHOTS}/themes-4-settings.png` })

    // Save.
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).waitFor({ timeout: 15000 })
    const saved = await api(bearer, `/themes/${live.id}/files/content?path=${encodeURIComponent('templates/index.json')}`)
    ok('Save writes the template file', saved.body.file.content.includes('Smoke-tested heading') && saved.body.file.content.includes('rich-text'), saved.body.file?.content?.slice(0, 200))
    const editor = await api(bearer, `/themes/${live.id}/editor?template=index`)
    ok('no drafts are left after saving', editor.body.drafts.length === 0, editor.body.drafts)

    // ── the code editor ────────────────────────────────────────────────────
    process.stdout.write('\nCode editor\n')
    await page.goto(`${BASE}/merchandising/themes/${live.id}/code`, { waitUntil: 'networkidle' })
    await page.getByText('Sections', { exact: true }).waitFor({ timeout: 20000 })
    await page.getByText('rich-text.liquid', { exact: true }).click()
    const code = page.getByLabel('File contents')
    await code.waitFor()
    ok('opens a section file', (await code.inputValue()).includes('{% schema %}'))
    const before = await code.inputValue()
    await code.fill(`${before}\n{% if broken %}`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByText(/not closed|endif/i).first().waitFor({ timeout: 10000 })
    ok('refuses Liquid that does not parse', true)
    await page.screenshot({ path: `${SHOTS}/themes-5-code.png` })
    await code.fill(before)
  } catch (error) {
    failures.push(String(error))
    process.stdout.write(`  ✗ ${String(error).split('\n')[0]}\n`)
    await page.screenshot({ path: `${SHOTS}/themes-failure.png` }).catch(() => undefined)
  } finally {
    // Put the home page back the way it was.
    const restored = await api(bearer, `/themes/${live.id}/files`, { method: 'PUT', body: { path: 'templates/index.json', content: originalIndex } })
    await api(bearer, `/themes/${live.id}/drafts`, { method: 'DELETE' })
    ok('the live home page is restored', restored.status === 200, restored.body)
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
