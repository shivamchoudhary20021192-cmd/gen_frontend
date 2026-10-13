/**
 * The shelf tag, from the admin form to the storefront payload.
 *
 *   npm run dev              # admin on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-tags.mjs
 *
 * What is worth proving:
 *
 *   * the product form offers the tag at all — it is new, and for months the
 *     three columns behind it were writable only by the seed script
 *   * choosing one tag clears the others, so a product cannot be flagged twice
 *   * a bespoke tag reaches the storefront in the merchant's own words
 *   * an end date in the past means the tag is simply not in the public payload
 *   * "New" lapses on the calendar rather than on someone remembering: a launch
 *     published beyond the window stops claiming to be new even with the box
 *     still ticked
 *
 * It borrows a real product, records what the tag fields were, and puts them
 * back — including the publication date it moves to test the window.
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
    console.log(`  ✗ ${label}${detail === undefined ? '' : `\n      ${JSON.stringify(detail).slice(0, 220)}`}`)
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

let currentToken = null

async function api(path, { method = 'GET', body, token } = {}) {
  if (token) currentToken = token
  const send = () =>
    fetch(`${API}/admin/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  let response = await send()
  if (response.status === 401) {
    currentToken = await adminToken()
    response = await send()
  }
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

/** What the shop says about a product right now. */
async function publicTag(slug) {
  const response = await fetch(`${API}/api/v1/products/${slug}`)
  if (!response.ok) return { missing: response.status }
  const body = await response.json()
  return body.product?.tag ?? null
}

const run = async () => {
  const token = await adminToken()
  console.log('\nVeylog admin UI — shelf tags\n')

  // A published product with a storefront page, so the round trip is visible.
  const listing = await fetch(`${API}/api/v1/products?limit=1`).then((r) => r.json())
  const slug = listing.products?.[0]?.slug
  const productId = listing.products?.[0]?.id
  ok('there is a published product to tag', Boolean(productId && slug), listing.products?.[0])
  if (!productId) {
    console.log('\nnothing to test against\n')
    process.exit(1)
  }

  // Wrapped in `product`, which is what the PATCH schema expects. Sending the
  // fields bare returns 422 — and a restore that quietly 422s is how a suite
  // leaves a real product wearing a test's badge.
  const restore = (fields) => api(`/products/${productId}`, { method: 'PATCH', body: { product: fields }, token })

  const before = await api(`/products/${productId}`, { token })
  const original = {
    is_new: before.body?.product?.is_new ?? before.body?.is_new ?? false,
    is_bestseller: before.body?.product?.is_bestseller ?? before.body?.is_bestseller ?? false,
    badge: before.body?.product?.badge ?? before.body?.badge ?? null,
    badge_expires_at: before.body?.product?.badge_expires_at ?? before.body?.badge_expires_at ?? null,
  }

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

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

  // Saving may leave the form for the list, so every step re-opens it rather
  // than reloading whatever happens to be on screen.
  const openForm = async () => {
    await page.goto(`${BASE}/products/${productId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
  }
  const save = async () => {
    await page.getByRole('button', { name: /^Save/ }).first().click()
    await page.waitForTimeout(2500)
  }

  try {
    // ── the form offers it ──────────────────────────────────────────────────
    console.log('The form')
    await openForm()

    const card = page.locator('text=Shelf tag').first()
    ok('the product form has a Shelf tag card', await card.isVisible().catch(() => false))
    await card.scrollIntoViewIfNeeded().catch(() => {})

    const select = page.getByLabel('Tag', { exact: true })
    ok('the tag is a short list, not a free-text box', await select.isVisible().catch(() => false))

    // The wording and date only exist for a bespoke tag — a "New" with its own
    // end date would be two rules fighting over the same claim.
    ok('no wording field until one is needed', (await page.getByLabel('Wording').count()) === 0)

    // ── a bespoke tag, with an end date in the past ─────────────────────────
    console.log('\nAn expired campaign')
    await select.click()
    await page.getByRole('option', { name: 'Something else' }).click()
    await page.waitForTimeout(300)
    ok('choosing it reveals the wording and the end date', (await page.getByLabel('Wording').count()) === 1)

    await page.getByLabel('Wording').fill('Limited edition')
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await page.getByLabel('Ends on').fill(yesterday)
    await save()

    const stored = await api(`/products/${productId}`, { token })
    const storedBadge = stored.body?.product?.badge ?? stored.body?.badge
    ok('the wording was saved', storedBadge === 'Limited edition', storedBadge)
    ok('the tag it replaced was cleared', (stored.body?.product?.is_bestseller ?? stored.body?.is_bestseller) === false)
    ok('an expired campaign never reaches the shop', (await publicTag(slug)) === null, await publicTag(slug))

    // ── the same campaign, still running ────────────────────────────────────
    console.log('\nA campaign still running')
    const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    await openForm()
    ok(
      'the form reads the stored badge back as a bespoke tag',
      (await page.getByLabel('Wording').inputValue()) === 'Limited edition',
    )
    await page.getByLabel('Ends on').fill(nextMonth)
    await save()

    const live = await publicTag(slug)
    ok('a live campaign shows in the merchant’s own words', live?.label === 'Limited edition', live)
    ok('and is drawn as a durable tag rather than a launch', live?.key === 'custom' && live?.tone === 'dark', live)

    // ── new lapses on the calendar ──────────────────────────────────────────
    console.log('\nNew, and the calendar')
    await openForm()
    await page.getByLabel('Tag', { exact: true }).click()
    await page.getByRole('option', { name: 'New', exact: true }).click()
    await save()

    ok('a launch inside the window says New', (await publicTag(slug))?.key === 'new', await publicTag(slug))
    ok(
      'choosing New cleared the bespoke wording',
      ((await api(`/products/${productId}`, { token })).body?.product?.badge ?? null) === null,
    )

    // Move publication back beyond the window and the claim lapses, with the
    // box still ticked. That is the whole point of deriving it from the date.
    const published = await api(`/products/${productId}`, { token })
    const publishedAt = published.body?.product?.published_at ?? published.body?.published_at ?? null
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString()
    const moved = await restore({ published_at: old })

    if (moved.status < 300) {
      ok('an old launch stops calling itself new', (await publicTag(slug)) === null, await publicTag(slug))
      ok(
        'even though the flag is still on',
        ((await api(`/products/${productId}`, { token })).body?.product?.is_new ?? false) === true,
      )
      if (publishedAt) await restore({ published_at: publishedAt })
    } else {
      // The publication date is not part of the product update schema — it is
      // owned by publishing. Say so rather than passing an assertion that never
      // ran; the window itself is covered exhaustively, with no database at
      // all, by the backend's scripts/check-tags.ts.
      console.log(`  · publish date is not editable here (${moved.status}) — the window is covered by check-tags.ts`)
    }

    ok('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3))
  } finally {
    // Put the product back exactly as it was found, and say so out loud. A
    // borrowed product left wearing a test's badge is a live storefront telling
    // customers something untrue, which is worse than a failing assertion.
    const put = await restore(original)
    const after = await api(`/products/${productId}`, { token })
    const now = after.body?.product ?? after.body ?? {}
    ok(
      'the product was put back as it was found',
      put.status < 300 &&
        Boolean(now.is_new) === Boolean(original.is_new) &&
        Boolean(now.is_bestseller) === Boolean(original.is_bestseller) &&
        (now.badge ?? null) === (original.badge ?? null),
      { status: put.status, original, now: { is_new: now.is_new, is_bestseller: now.is_bestseller, badge: now.badge } },
    )
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
