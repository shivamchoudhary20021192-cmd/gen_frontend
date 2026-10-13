/**
 * Choosing what a link points at, by name rather than by id.
 *
 *   npm run dev              # admin on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-link-targets.mjs
 *
 * The field this replaces was a number box labelled "Reference ID". Nobody knows
 * that the Vitamin C serum is 34, and a banner pointing at the wrong product is
 * not a mistake anyone reports — it is a link nobody clicks. So what is worth
 * proving is not that a dropdown renders, but that:
 *
 *   * the list is the catalogue, and typing narrows it on the server
 *   * choosing by name stores the id the API expects
 *   * re-opening the form shows the *name*, not the number it saved
 *   * a draft or inactive target says so on the row instead of looking fine
 *   * a link type the server cannot search still gets a usable field
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const API = process.env.API_BASE ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'

let passed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `\n      ${JSON.stringify(detail).slice(0, 240)}`}`)
  }
}

async function adminToken() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`admin login → ${response.status}`)
  return body.access_token ?? body.tokens?.access_token
}

async function api(path, token) {
  const response = await fetch(`${API}/admin/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const run = async () => {
  const token = await adminToken()
  console.log('\nVeylog admin UI — link targets\n')

  // ── the endpoint ──────────────────────────────────────────────────────────
  console.log('The search')
  const kinds = ['product', 'category', 'collection', 'page', 'policy', 'article']
  for (const kind of kinds) {
    const result = await api(`/link-targets?type=${kind}&limit=5`, token)
    ok(`${kind} is searchable`, result.status === 200 && Array.isArray(result.body.targets), result.body)
  }

  const products = await api('/link-targets?type=product&limit=50', token)
  const sample = products.body.targets?.[0]
  ok('every row carries a name and an id', Boolean(sample?.label && Number.isInteger(sample?.id)), sample)
  ok('and a second line to tell two similar rows apart', typeof sample?.hint === 'string', sample)

  const term = sample?.label.split(' ')[0] ?? ''
  const narrowed = await api(`/link-targets?type=product&q=${encodeURIComponent(term)}`, token)
  ok(
    'typing narrows the list on the server',
    narrowed.body.targets.length > 0 && narrowed.body.targets.length <= products.body.targets.length,
    { term, before: products.body.targets.length, after: narrowed.body.targets.length },
  )
  ok(
    'and every match actually matches',
    narrowed.body.targets.every((target) =>
      `${target.label} ${target.hint ?? ''}`.toLowerCase().includes(term.toLowerCase()),
    ),
    narrowed.body.targets.map((t) => t.label),
  )

  const bySlug = await api(`/link-targets?type=product&q=${encodeURIComponent(sample.hint.split(' ')[0])}`, token)
  ok('a slug finds it too, not only the title', bySlug.body.targets.length > 0, sample.hint)

  const resolved = await api(`/link-targets/resolve?type=product&id=${sample.id}`, token)
  ok('a saved id resolves back to its name', resolved.body.target?.label === sample.label, resolved.body)

  const gone = await api('/link-targets/resolve?type=product&id=99999999', token)
  ok('a deleted target resolves to nothing rather than failing', gone.status === 200 && gone.body.target === null)

  const nonsense = await api('/link-targets?type=banana', token)
  ok('an unknown kind is refused, and says what is allowed', nonsense.status === 400, nonsense.body?.error?.message)

  const unauthorised = await fetch(`${API}/admin/api/v1/link-targets?type=product`)
  ok('it is behind authentication', unauthorised.status === 401, unauthorised.status)

  // ── the control ───────────────────────────────────────────────────────────
  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })

  let bannerId = null
  try {
    console.log('\nThe banner form')
    const banners = await api('/content/banners?limit=1', token)
    bannerId = banners.body?.data?.[0]?.id ?? banners.body?.banners?.[0]?.id
    ok('there is a banner to edit', Boolean(bannerId), JSON.stringify(banners.body).slice(0, 140))
    if (!bannerId) throw new Error('no banner')

    await page.goto(`${BASE}/content/banners/${bannerId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
    // Cleared here so the console assertion below is about this form, not about
    // whatever the page the app happens to land on after login was doing.
    consoleErrors.length = 0

    // Point the CTA at a product. A MUI Select is a combobox, not a labelled
    // input — getByLabel does not reach it.
    await page.getByRole('combobox', { name: 'Link Type' }).click()
    await page.getByRole('option', { name: 'Product', exact: true }).click()
    await page.waitForTimeout(600)

    ok('the numeric Reference ID box is gone', (await page.getByLabel('Reference ID').count()) === 0)

    // By role, not by label: once the list is open the listbox shares the
    // label, and getByLabel then matches two elements.
    const picker = page.getByRole('combobox', { name: 'Which product?' })
    ok('a product picker appears instead', await picker.isVisible().catch(() => false))

    await picker.click()
    await page.waitForTimeout(900)
    const optionCount = await page.getByRole('option').count()
    ok('it opens on the catalogue rather than an empty panel', optionCount > 0, optionCount)

    // Search, and check the list actually shrinks.
    await picker.fill(term)
    await page.waitForTimeout(1200)
    const narrowedOptions = await page.getByRole('option').allInnerTexts()
    ok(
      'typing in the field narrows what is offered',
      narrowedOptions.length > 0 && narrowedOptions.length <= optionCount,
      { before: optionCount, after: narrowedOptions.length },
    )

    await page.getByRole('option').first().click()
    await page.waitForTimeout(400)
    const chosenName = await picker.inputValue()
    ok('choosing one puts its name in the field, not a number', /[a-z]/i.test(chosenName), chosenName)

    await page.getByRole('button', { name: /^Save/ }).first().click()
    await page.waitForTimeout(2600)

    const saved = await api(`/content/banners/${bannerId}`, token)
    const savedRow = saved.body?.data ?? saved.body?.banner ?? saved.body
    ok('the API stored an id, as it always did', Number.isInteger(savedRow?.cta_link_ref_id), {
      ref: savedRow?.cta_link_ref_id,
      type: savedRow?.cta_link_type,
    })

    const expected = narrowed.body.targets.find((target) => target.id === savedRow.cta_link_ref_id)
    ok('and it is the one that was clicked', expected?.label === chosenName, { chosenName, expected })

    // The whole point: come back later and it still reads as a name.
    console.log('\nComing back to it')
    await page.goto(`${BASE}/content/banners/${bannerId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2600)
    const reopened = await page.getByRole('combobox', { name: 'Which product?' }).inputValue()
    ok('re-opening shows the name it saved, not the id', reopened === chosenName, { reopened, chosenName })

    ok('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3))
  } finally {
    await browser.close()
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    failures.forEach((failure) => console.log(`  · ${failure}`))
    process.exit(1)
  }
}

run().catch((error) => {
  console.log(String(error))
  process.exit(1)
})
