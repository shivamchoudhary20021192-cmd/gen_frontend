/**
 * Browser smoke test for Settings → Domains, the way a merchant uses it:
 * connect a domain, "set up DNS", watch it go live, make it primary, see the
 * old address redirect, give a market its own domain, and buy a new domain.
 *
 * The backend must run with DNS_STATIC_FILE (the test plays the merchant's DNS
 * provider by writing that file), EDGE_PROVIDER=local and REGISTRAR=sandbox.
 *
 *   SMOKE_DNS_FILE=<the backend's DNS_STATIC_FILE> ADMIN_URL=http://localhost:5176 ADMIN_API=http://127.0.0.1:4100 \
 *   PW_CHANNEL=chrome SHOTS_DIR=… node scripts/ui-smoke-domains.mjs
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const BASE = process.env.ADMIN_URL ?? 'http://localhost:5176'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4100'
const SHOTS = process.env.SHOTS_DIR ?? 'screenshots'
const DNS_FILE = process.env.SMOKE_DNS_FILE
const EDGE_IP = process.env.SMOKE_EDGE_IP ?? '203.0.113.10'
const BACKEND = path.resolve(process.env.BACKEND_DIR ?? '../veylog-backend')
createRequire(path.join(BACKEND, 'package.json'))('dotenv').config({ path: path.join(BACKEND, '.env') })
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
if (!DNS_FILE) throw new Error('Set SMOKE_DNS_FILE to the backend’s DNS_STATIC_FILE.')

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

/** A storefront request with a given Host, as the edge would forward it. */
function storefront(host, route) {
  const url = new URL(API)
  return new Promise((resolve, reject) => {
    http
      .get({ host: url.hostname, port: Number(url.port || 80), path: route, headers: { Host: host } }, (response) => {
        response.resume()
        response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location ?? null }))
      })
      .on('error', reject)
  })
}

/** The merchant, at their DNS provider. */
function setDns(records) {
  const zone = fs.existsSync(DNS_FILE) ? JSON.parse(fs.readFileSync(DNS_FILE, 'utf8') || '{}') : {}
  Object.assign(zone, records)
  fs.writeFileSync(DNS_FILE, JSON.stringify(zone, null, 1))
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const tokens = await login()
  const bearer = tokens.access
  const stamp = Date.now().toString(36)
  const apex = `smoke-${stamp}.com`
  const www = `www.${apex}`
  const before = (await api(bearer, '/domains')).body
  const originalPrimary = before.domains.find((domain) => domain.is_primary)

  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.addInitScript(([access, refresh]) => {
    localStorage.setItem('veylog.access_token', access)
    localStorage.setItem('veylog.refresh_token', refresh)
  }, [tokens.access, tokens.refresh])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const created = []

  try {
    process.stdout.write('\nConnecting a domain\n')
    await page.goto(`${BASE}/settings/domains`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText('Primary domain', { exact: true }).waitFor({ timeout: 60000 })
    ok('shows the primary domain', await page.getByText(originalPrimary.hostname, { exact: true }).first().waitFor({ timeout: 15000 }).then(() => true, () => false))
    await page.getByRole('button', { name: 'Connect existing domain' }).click()
    await page.getByRole('dialog').getByLabel('Domain').fill(`https://${apex}/`)
    ok('offers to connect the www address too', await page.getByRole('dialog').getByText(www).isVisible())
    await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
    await page.getByRole('dialog').getByText('Waiting for DNS').first().waitFor({ timeout: 20000 })
    ok('shows the records to create, per domain', (await page.getByRole('dialog').locator('table').count()) === 2)
    ok('with help for the merchant’s provider', await page.getByRole('dialog').getByLabel('Where did you buy the domain?').isVisible())
    await page.screenshot({ path: `${SHOTS}/domains-1-records.png` })

    const listed = (await api(bearer, '/domains')).body.domains
    const wwwRow = listed.find((domain) => domain.hostname === www)
    const apexRow = listed.find((domain) => domain.hostname === apex)
    created.push(wwwRow.id, apexRow.id)
    // The merchant sets DNS: www to its own target, the apex to the edge — with a leftover Shopify record.
    setDns({ [www]: { CNAME: [wwwRow.dns.records.find((record) => record.type === 'CNAME').value] }, [apex]: { A: [EDGE_IP, '23.227.38.65'] } })
    await page.getByRole('dialog').getByRole('button', { name: 'Verify connection' }).click()
    await page.getByRole('dialog').getByText(/pointing to 23\.227\.38\.65 \(Shopify\)/).waitFor({ timeout: 20000 })
    ok('names the leftover record, and where it points', true)
    setDns({ [apex]: { A: [EDGE_IP] } })
    await page.getByRole('dialog').getByRole('button', { name: 'Verify connection' }).click()
    await page.getByRole('dialog').getByText('Connected and secure').waitFor({ timeout: 30000 })
    ok('both addresses go live', true)
    await page.screenshot({ path: `${SHOTS}/domains-2-connected.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()

    process.stdout.write('\nPrimary domain and redirects\n')
    await page.getByRole('row', { name: new RegExp(`^${apex.replace(/\./g, '\\.')}`) }).getByRole('button', { name: `Actions for ${apex}` }).click()
    await page.getByRole('menuitem', { name: 'Set as primary' }).click()
    await page.getByText(`${apex} is now your primary domain`).waitFor({ timeout: 15000 })
    ok('makes it primary', true)
    const onPrimary = await storefront(apex, '/collections/all?page=2')
    const onWww = await storefront(www, '/collections/all?page=2')
    const onOld = await storefront(originalPrimary.hostname, '/collections/all')
    ok('the primary serves the store', onPrimary.status === 200, onPrimary)
    ok('www redirects to it, keeping the page', onWww.status === 301 && onWww.location === `http://${apex}/collections/all?page=2`, onWww)
    ok('so does the previous primary', onOld.status === 301 && onOld.location === `http://${apex}/collections/all`, onOld)

    await page.getByRole('row', { name: new RegExp(`^${www.replace(/\./g, '\\.')}`) }).click()
    await page.getByText('History', { exact: true }).waitFor({ timeout: 15000 })
    ok('the domain drawer shows its progress and history', await page.getByText('Certificate issued').isVisible())
    await page.screenshot({ path: `${SHOTS}/domains-3-drawer.png` })
    await page.keyboard.press('Escape')

    process.stdout.write('\nTransferring a domain in\n')
    await page.getByRole('row', { name: new RegExp(`^${apex.replace(/\./g, '\\.')}`) }).getByRole('button', { name: `Actions for ${apex}` }).click()
    await page.getByRole('menuitem', { name: 'Transfer domain here' }).click()
    await page.getByRole('dialog').getByText('Enter it here').waitFor({ timeout: 20000 })
    ok('offers the transfer with its price, billed on completion', await page.getByRole('dialog').getByText(/adds 1 year to the registration/).isVisible())
    ok('asks for the code before it can start', !(await page.getByRole('dialog').getByRole('button', { name: 'Start transfer' }).isEnabled()))
    await page.screenshot({ path: `${SHOTS}/domains-3b-transfer.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    process.stdout.write('\nBuying a domain\n')
    await page.getByRole('button', { name: 'Buy new domain' }).click()
    await page.getByRole('dialog').getByPlaceholder(/Search for a name/).fill(`smokeshop${stamp}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Search' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Buy' }).first().waitFor({ timeout: 20000 })
    ok('shows available names with prices', (await page.getByRole('dialog').getByText(/first year/).count()) > 0)
    await page.screenshot({ path: `${SHOTS}/domains-4-search.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Buy' }).first().click()
    const dialog = page.getByRole('dialog')
    for (const [label, value] of [['First name', 'Asha'], ['Last name', 'Rao'], ['Email', 'asha@example.com'], ['Phone', '+91 98765 43210'], ['Address', '14 Lake View Road'], ['City', 'Bengaluru'], ['State / province', 'Karnataka'], ['PIN / postal code', '560001']]) {
      await dialog.getByLabel(label, { exact: true }).fill(value)
    }
    await dialog.getByRole('button', { name: /^Buy for/ }).click()
    await page.getByText(/is yours — it is being connected now/).waitFor({ timeout: 30000 })
    ok('buys it', true)
    await page.getByRole('heading', { name: 'Managed here' }).waitFor({ timeout: 10000 })
    const renew = page.locator(`input[aria-label^="Auto-renew smokeshop${stamp}"]`).first()
    ok('lists it with renewal and auto-renew', await renew.isChecked())
    await page.screenshot({ path: `${SHOTS}/domains-5-bought.png`, fullPage: true })

    process.stdout.write('\nOperators\n')
    await page.goto(`${BASE}/console/domains`, { waitUntil: 'load', timeout: 90000 })
    await page.getByText(/custom domains · edge/).waitFor({ timeout: 30000 })
    ok('the console lists every store’s domains by status', await page.locator('tbody tr').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
    await page.screenshot({ path: `${SHOTS}/domains-6-console.png` })

    ok('no page errors', errors.length === 0, errors)
  } catch (error) {
    failures.push(String(error))
    process.stdout.write(`  ✗ ${String(error).split('\n').slice(0, 12).join('\n    ')}\n`)
    await page.screenshot({ path: `${SHOTS}/domains-failure.png` }).catch(() => undefined)
  } finally {
    await browser.close()
    // Leave the store as it was: its primary back, the test's domains gone.
    if (originalPrimary) await api(bearer, `/domains/${originalPrimary.id}/primary`, { method: 'POST' })
    const bought = (await api(bearer, '/domains')).body.domains?.filter((domain) => domain.hostname.includes(`smokeshop${stamp}`)) ?? []
    for (const id of [...created, ...bought.map((domain) => domain.id)]) await api(bearer, `/domains/${id}`, { method: 'DELETE' })
  }

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
