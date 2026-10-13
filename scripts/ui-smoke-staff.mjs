/**
 * Headless click-through of staff accounts and roles.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-staff.mjs
 *
 * The point of this suite is that role assignment has a real effect: it creates
 * a role with a narrow permission set, assigns it to a new account, signs in as
 * that account, and checks the sidebar it receives is smaller than the super
 * admin's. A staff screen that saves without changing what anyone can do is the
 * failure this is looking for.
 */
import { chromium } from 'playwright'
import { existsSync, writeFileSync } from 'node:fs'

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

const stamp = Date.now().toString(36).toUpperCase().slice(-5)
const NEW_EMAIL = `smoke.${stamp.toLowerCase()}@veylor.com`
const NEW_PASSWORD = `SmokePass${stamp}1`
const ROLE_NAME = `Smoke reader ${stamp}`

const signIn = async (page, email, password) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
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

  console.log('\nVeylog admin UI — staff and roles\n')

  console.log('Login')
  await signIn(page, EMAIL, PASSWORD)
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1200)

  const superAdminRoutes = await page.evaluate(async () => {
    const token = localStorage.getItem('veylog.access_token')
    const response = await fetch('/admin/api/v1/menu-navigation', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return (await response.json()).flat.length
  })

  // ── roles ──────────────────────────────────────────────────────────────────
  console.log('\nRoles')
  await page.goto(`${BASE}/settings/roles`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const roleRows = await page.locator('table tbody tr').count()
  ok('the roles screen lists the seeded roles', roleRows > 0, `${roleRows} roles`)

  await page.getByRole('button', { name: /Create role/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('textbox', { name: 'Name' }).fill(ROLE_NAME)
  await page.waitForTimeout(300)
  const slugValue = await dialog.getByRole('textbox', { name: 'Slug' }).inputValue()
  ok('the slug is derived from the name', /^smoke-reader-/.test(slugValue), slugValue)

  // Grant exactly ONE module, so the effect on the menu is unmistakable — and
  // so the "no access to staff" assertion below means something.
  ok('the permission matrix renders', (await dialog.getByRole('checkbox').count()) > 5)
  await dialog.getByRole('checkbox', { name: 'All Products permissions' }).check()
  await page.waitForTimeout(300)

  const selectedChip = await dialog.getByText(/\d+ selected/).first().textContent()
  ok('selecting a module ticks its permissions', /[1-9]/.test(selectedChip ?? ''), selectedChip ?? '')

  await dialog.getByRole('button', { name: 'Save' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 10000 })
  await page.waitForTimeout(1500)
  ok('the new role appears in the list', await page.getByText(ROLE_NAME).first().isVisible())

  // ── staff account ──────────────────────────────────────────────────────────
  console.log('\nStaff account')
  await page.goto(`${BASE}/settings/staff`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  ok('the staff list renders', (await page.locator('table tbody tr').count()) > 0)

  await page.getByRole('button', { name: /Add staff/ }).click()
  await page.waitForURL('**/settings/staff/new')
  await page.waitForTimeout(800)

  await page.getByRole('textbox', { name: 'First name' }).fill('Smoke')
  await page.getByRole('textbox', { name: 'Last name' }).fill('Reader')
  await page.getByRole('textbox', { name: 'Email' }).fill(NEW_EMAIL)

  const createButton = page.getByRole('button', { name: 'Create account' })
  ok('saving is blocked until a role is chosen', await createButton.isDisabled())

  await page.getByText('Set a starting password').click()
  await page.waitForTimeout(300)
  await page.locator('input[type="password"]').first().fill('short')
  ok('a weak password keeps saving blocked', await createButton.isDisabled())
  await page.locator('input[type="password"]').first().fill(NEW_PASSWORD)

  const roleCheckbox = page.locator('label', { hasText: ROLE_NAME }).locator('input')
  await roleCheckbox.check()
  await page.waitForTimeout(400)
  ok('with a role and a valid password, saving is allowed', await createButton.isEnabled())

  await createButton.click()
  await page.waitForURL(/\/settings\/staff\/\d+$/, { timeout: 15000 })
  await page.waitForTimeout(1800)
  ok('the account is created and opens its own page', /\/settings\/staff\/\d+$/.test(page.url()))

  const effective = await page.getByText('products.view').first().isVisible().catch(() => false)
  ok('the form shows the permissions the role resolves to', effective)

  // ── the assignment actually does something ─────────────────────────────────
  console.log('\nDoes the role bite?')
  const staffPage = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  await signIn(staffPage, NEW_EMAIL, NEW_PASSWORD)
  await staffPage.waitForTimeout(3000)

  const staffRoutes = await staffPage.evaluate(async () => {
    const token = localStorage.getItem('veylog.access_token')
    if (!token) return -1
    const response = await fetch('/admin/api/v1/menu-navigation', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return -2
    return (await response.json()).flat.length
  })

  ok('the new account can sign in', staffRoutes > 0, `menu rows: ${staffRoutes}`)
  ok(
    'it receives a smaller menu than the super admin',
    staffRoutes > 0 && staffRoutes < superAdminRoutes,
    `${staffRoutes} vs ${superAdminRoutes}`,
  )

  const forbidden = await staffPage.evaluate(async () => {
    const token = localStorage.getItem('veylog.access_token')
    const response = await fetch('/admin/api/v1/admin-users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.status
  })
  ok('and is refused the staff endpoint it has no permission for', forbidden === 403, `status ${forbidden}`)
  await staffPage.close()

  // ── suspend ────────────────────────────────────────────────────────────────
  console.log('\nSuspend')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Suspend account' }).click()
  await page.waitForTimeout(2000)
  ok(
    'suspending is reflected on the page',
    await page.getByRole('button', { name: 'Reactivate account' }).isVisible().catch(() => false),
  )

  const suspendedLogin = await page.evaluate(
    async ([email, password]) => {
      const response = await fetch('/admin/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return response.status
    },
    [NEW_EMAIL, NEW_PASSWORD],
  )
  ok('a suspended account cannot sign in', suspendedLogin >= 400, `status ${suspendedLogin}`)

  await page.getByRole('button', { name: 'Reactivate account' }).click()
  await page.waitForTimeout(1800)
  ok(
    'and can be reactivated',
    await page.getByRole('button', { name: 'Suspend account' }).isVisible().catch(() => false),
  )

  // ── self-lockout guard ─────────────────────────────────────────────────────
  console.log('\nSelf-lockout guard')
  const meId = await page.evaluate(async () => {
    const token = localStorage.getItem('veylog.access_token')
    const response = await fetch('/admin/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return (await response.json()).admin.id
  })
  await page.goto(`${BASE}/settings/staff/${meId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  ok(
    'your own account offers no Suspend button',
    (await page.getByRole('button', { name: 'Suspend account' }).count()) === 0,
  )
  ok(
    'your own account offers no Delete button',
    (await page.getByRole('button', { name: 'Delete account' }).count()) === 0,
  )

  await page.screenshot({ path: '/tmp/ui-staff.png', fullPage: false })

  console.log('\nConsole')
  const meaningful = consoleErrors.filter(
    (t) =>
      !t.includes('Download the React DevTools') &&
      !t.includes('favicon') &&
      !t.includes('401') &&
      !t.includes('403'),
  )
  ok('no unexpected console errors', meaningful.length === 0, meaningful.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n${'='.repeat(48)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  if (failures.length) console.log(`\n  Failed:\n${failures.map((f) => `    - ${f}`).join('\n')}`)
  console.log(`${'='.repeat(48)}\n`)
  writeFileSync('/tmp/ui-smoke-staff-result.json', JSON.stringify({ passed, failed, failures }, null, 2))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nStaff smoke crashed:', error)
  process.exit(1)
})
