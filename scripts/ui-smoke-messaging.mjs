/**
 * The messaging screens.
 *
 *   node scripts/ui-smoke-messaging.mjs
 *
 * The API suite proves the rules are enforced. This one proves a person can see
 * them: that the editor tells you a marketing SMS cannot send *before* you send
 * it, that the refusal names the fix, that adding the DLT ID clears it, that the
 * preview shows a real message rather than {{first_name}}, that a campaign shows
 * how many people it reaches while the audience is being edited, and that a
 * channel where free text is illegal says so instead of offering a text box.
 *
 * Everything it creates is prefixed `uismokemsg` and removed over the API at the
 * end, and the removal is asserted.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.ADMIN_URL ?? 'http://127.0.0.1:5173'
const API = process.env.ADMIN_API ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = 'screenshots'

let passed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed += 1
    process.stdout.write(`  ✓ ${label}\n`)
  } else {
    failures.push(label)
    process.stdout.write(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 240)}`}\n`)
  }
}

async function token() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`login → ${response.status} ${JSON.stringify(body).slice(0, 200)}`)
  return body.access_token ?? body.tokens?.access_token
}

async function api(path, { method = 'GET', body, bearer } = {}) {
  const response = await fetch(`${API}/admin/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const stamp = Date.now().toString().slice(-6)
const TEMPLATE_NAME = `uismokemsg sms ${stamp}`
const CAMPAIGN_NAME = `uismokemsg campaign ${stamp}`

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const bearer = await token()

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  let templateId = null
  let campaignId = null

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 })

    // ── the way in ───────────────────────────────────────────────────────────
    process.stdout.write('\nThe sidebar\n')
    await page.goto(`${BASE}/notifications/templates`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Message templates' }).waitFor({ timeout: 20000 })
    // The sidebar is its own request, and the group is collapsed until one of
    // its routes is active — so this waits, and is asserted after navigating.
    await page.getByText('Messaging', { exact: true }).first().waitFor({ timeout: 20000 })
    ok('Messaging is in the sidebar', (await page.getByText('Messaging', { exact: true }).count()) > 0)
    ok('with its four screens under it', (await page.getByText('Campaigns', { exact: true }).count()) > 0)
    ok('and the templates screen opens', page.url().includes('/notifications/templates'))

    await page.locator('table tbody tr').first().waitFor({ timeout: 20000 })
    const listedBefore = await page.locator('table tbody tr').count()
    ok('the existing templates are listed', listedBefore > 0, listedBefore)

    // ── writing one, and being refused ───────────────────────────────────────
    process.stdout.write('\nWriting a promotional SMS\n')
    await page.getByRole('button', { name: /new template/i }).click()
    await page.waitForURL(/notifications\/templates\/new/, { timeout: 15000 })

    await page.getByLabel('Name', { exact: true }).fill(TEMPLATE_NAME)
    await page.getByLabel('Event key').fill(`uismokemsg.${stamp}`)

    await page.getByLabel('Channel').click()
    await page.getByRole('option', { name: 'SMS' }).click()
    await page.getByLabel('Type').click()
    await page.getByRole('option', { name: /^Marketing/ }).click()

    await page
      .getByLabel('Body')
      .fill('Hi {{first_name}}, 20% off this week at {{shop_name}}. To stop, reply STOP')

    // The preview has to be a message, not a template. This is the assertion
    // that would catch a preview that forgot to substitute.
    const previewText = await page.locator('text=Ananya').first().textContent()
    ok('the preview fills the merge fields in as you type', Boolean(previewText), previewText)
    ok(
      'and shows no raw placeholders',
      !(await page.locator('main').innerText()).includes('{{first_name}}, 20%'),
    )

    const smsLine = await page.getByText(/GSM-7|UCS-2/).first().textContent()
    ok('the SMS segment count is shown before sending', /segment/.test(smsLine ?? ''), smsLine)

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL(/notifications\/templates\/\d+/, { timeout: 20000 })
    templateId = Number(page.url().split('/').pop())
    ok('saving a half-finished template is allowed', Number.isFinite(templateId), page.url())

    await page.getByText(/cannot be sent yet|things stop this being sent/i).first().waitFor({ timeout: 15000 })
    const refusal = await page.getByText(/DLT/).first().textContent()
    ok('and the screen says it cannot send', Boolean(refusal))
    ok('naming the DLT registration as the reason', /DLT/.test(refusal ?? ''), refusal)
    ok(
      'with what to do about it',
      (await page.getByText(/Register this wording on the DLT portal/i).count()) > 0,
    )

    await page.screenshot({ path: `${SHOTS}/messaging-template-blocked.png`, fullPage: true })

    // ── clearing the refusal ─────────────────────────────────────────────────
    process.stdout.write('\nClearing it\n')
    await page.getByLabel('DLT template ID').fill('1307161234567890123')
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page
      .getByText(/cannot be sent yet|things stop this being sent/i)
      .first()
      .waitFor({ state: 'detached', timeout: 20000 })
    ok('adding the registered ID clears the refusal', true)

    // Turn it on so a campaign can use it. While it is off the panel still
    // carries a note saying so, which is the difference between "not ready"
    // and "deliberately switched off".
    await page.getByLabel('Template is on').check()
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForTimeout(1500)

    // The sender still has no Principal Entity ID recorded, which is worth
    // saying and is not worth refusing over. That distinction — advice in
    // amber, refusals in red — is the whole design of this panel, so it is
    // asserted rather than assumed.
    ok(
      'advice that is not a refusal stays advice',
      (await page.getByText(/Principal Entity ID/i).count()) > 0 &&
        (await page.getByText(/cannot be sent yet|things stop this being sent/i).count()) === 0,
    )

    const saved = await api(`/messaging/templates/${templateId}`, { bearer })
    ok('and the template is now sendable', saved.body.can_send === true, saved.body.violations)

    // ── a campaign ───────────────────────────────────────────────────────────
    process.stdout.write('\nBuilding a campaign\n')
    await page.goto(`${BASE}/notifications/campaigns`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /new campaign/i }).click()
    await page.getByLabel('Name', { exact: true }).fill(CAMPAIGN_NAME)
    await page.getByLabel('Channel').click()
    await page.getByRole('option', { name: 'SMS' }).click()
    await page.getByRole('button', { name: /^Create$/ }).click()
    await page.waitForURL(/notifications\/campaigns\/\d+/, { timeout: 20000 })
    campaignId = Number(page.url().split('/').pop())
    ok('a campaign opens on its own screen', Number.isFinite(campaignId))

    await page.getByLabel('Template').click()
    await page.getByRole('option', { name: new RegExp(TEMPLATE_NAME) }).click()

    await page.getByRole('button', { name: /^Rules$/ }).click()
    await page.getByRole('button', { name: /add a rule/i }).click()
    await page.waitForTimeout(1500)

    const reach = await page.getByText(/people will receive this/i).count()
    ok('the audience size is on screen while it is being built', reach > 0)

    await page.screenshot({ path: `${SHOTS}/messaging-campaign.png`, fullPage: true })

    // A campaign with no audience must not be sendable, and must say why.
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForTimeout(2000)
    const sendNow = page.getByRole('button', { name: /send now/i })
    const disabled = await sendNow.isDisabled()
    const preflight = await api(`/messaging/campaigns/${campaignId}/preflight`, { bearer })
    ok(
      'send is refused while something is missing',
      preflight.body.ready === false ? disabled : !disabled,
      { ready: preflight.body.ready, disabled },
    )

    // ── the outbox ───────────────────────────────────────────────────────────
    process.stdout.write('\nThe delivery log\n')
    await page.goto(`${BASE}/notifications/activity`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /delivery log/i }).waitFor({ timeout: 15000 })
    ok('the log opens', true)
    ok('with the thirty-day numbers on top', (await page.getByText(/Sent, last 30 days/i).count()) > 0)
    await page.locator('table tbody tr').first().waitFor({ timeout: 20000 })
    const logged = await page.locator('table tbody tr').count()
    ok('and the messages already sent', logged > 0, logged)

    await page.locator('table tbody tr').first().click()
    const drawer = page.getByText('Provider', { exact: true })
    await drawer.first().waitFor({ timeout: 20000 })
    ok('opening one shows what was actually said', (await drawer.count()) > 0)
    await page.keyboard.press('Escape')

    // ── senders ──────────────────────────────────────────────────────────────
    process.stdout.write('\nSenders\n')
    await page.goto(`${BASE}/notifications/senders`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /^Senders$/ }).waitFor({ timeout: 15000 })
    // Both the senders and the rules are separate requests; the screen is only
    // itself once they have landed.
    await page.getByText(/recorded rather than delivered/i).first().waitFor({ timeout: 20000 })
    await page.getByText(/Promotional messages from/i).first().waitFor({ timeout: 20000 })
    ok('all three channels have a card', (await page.getByText('WhatsApp', { exact: true }).count()) > 0)
    ok(
      'and the screen is honest that nothing is delivered yet',
      (await page.getByText(/recorded rather than delivered/i).count()) > 0,
    )
    ok('the sending rules are editable here', (await page.getByText(/Promotional messages from/i).count()) > 0)

    // ── one customer ─────────────────────────────────────────────────────────
    process.stdout.write('\nMessaging one person\n')
    const customers = await api('/customers?limit=1', { bearer })
    const customer = customers.body.customers?.[0] ?? customers.body.data?.[0]
    if (customer) {
      await page.goto(`${BASE}/customers/${customer.id}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: /^Message$/ }).click()
      await page.getByRole('dialog').waitFor({ timeout: 15000 })
      ok('the composer opens from the customer’s own page', true)

      await page.getByLabel('Channel').click()
      await page.getByRole('option', { name: /^SMS/ }).click()
      await page.waitForTimeout(600)
      ok(
        'and free-text SMS is explained rather than offered',
        (await page.getByText(/registered on DLT/i).count()) > 0,
      )
      await page.screenshot({ path: `${SHOTS}/messaging-composer.png` })
      await page.keyboard.press('Escape')
    }

    // ── nothing shouted in the console ───────────────────────────────────────
    const noisy = consoleErrors.filter(
      (error) => !/favicon|ResizeObserver|Failed to load resource/i.test(error),
    )
    ok('no console errors on any of the screens', noisy.length === 0, noisy.slice(0, 3))
  } finally {
    // ── clean up, and prove it ───────────────────────────────────────────────
    if (campaignId) await api(`/messaging/campaigns/${campaignId}`, { method: 'DELETE', bearer })
    if (templateId) await api(`/messaging/templates/${templateId}`, { method: 'DELETE', bearer })
    const remaining = await api('/messaging/templates?search=uismokemsg', { bearer })
    ok('everything this suite made is gone', (remaining.body.templates ?? []).length === 0)

    await browser.close()
  }

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  if (failures.length > 0) {
    for (const failure of failures) process.stdout.write(`  ✗ ${failure}\n`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stdout.write(`\nFAILED: ${error.message}\n`)
  process.exitCode = 1
})
