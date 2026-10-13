/**
 * Headless click-through of the review moderation queue.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-reviews.mjs
 *
 * Seeds a real review by buying a product through the public storefront API,
 * delivering the order and submitting as that buyer — so the screen is driven
 * against a row the storefront actually produced, not a fixture.
 *
 * What it checks beyond "the page renders":
 *
 *   - a pending review is on screen with its verified-purchase provenance
 *   - the buttons are the server's `next_statuses`, so an illegal move is
 *     absent rather than present-and-refused
 *   - rejecting without a reason is refused in the dialog
 *   - approving moves it to published and the product's rating follows
 *   - a review describing a skin reaction is visually marked and filterable
 *
 * Console errors fail the run.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// A trailing slash is stripped so `${BASE}/orders` never becomes `//orders`,
// and the root visit below re-adds it — `vite preview` serves the built bundle
// under the /admin/ base and answers a bare /admin with a hint page, not the app.
const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const API = process.env.SHOP_API ?? 'http://127.0.0.1:4000'
const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'admin@veylor.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2026'
const SHOTS = 'screenshots'

let passed = 0
const failures = []

function ok(label, condition, detail) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  }
}

let token = ''

/** Signs in and keeps the token, so a call can renew it mid-run. */
async function signIn() {
  const response = await fetch(`${API}/admin/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await response.json().catch(() => ({}))
  token = body.tokens?.access_token ?? body.access_token ?? ''
  return token
}

/**
 * An admin token lasts fifteen minutes; a browser walk-through takes longer.
 * A 401 on an authenticated call therefore means the clock ran out rather than
 * that anything is wrong, so it signs in again and tries once more. Without
 * this the suite dies halfway with an authentication error that has nothing to
 * do with what it was testing.
 */
const call = async (base, path, { method = 'GET', body, auth = false } = {}) => {
  const send = async () => {
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }
    if (auth) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }

  let result = await send()
  if (auth && result.status === 401) {
    await signIn()
    result = await send()
  }
  return result
}

const shop = (path, options) => call(`${API}/api/v1`, path, options)
const admin = (path, options) => call(`${API}/admin/api/v1`, path, { ...options, auth: true })

async function adminOrThrow(path, options) {
  const result = await admin(path, options)
  if (result.status >= 400) throw new Error(`${path} → ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`)
  return result.body
}

/**
 * The storefront limiters are real and correctly tight — 5 reviews per 10
 * minutes from one address, and the same for carts and checkouts. This suite
 * places two orders and writes two reviews from a single address, so a second
 * run inside the window would be refused by a limiter that is doing its job.
 * The buckets are cleared here rather than loosened in the API.
 *
 * Non-fatal: without a mysql client the run simply has one shot per window.
 */
function clearRateBuckets() {
  const buckets = ['shop.review', 'shop.checkout', 'shop.cart']
  const list = buckets.map((b) => `'${b}'`).join(',')
  try {
    execFileSync('mysql', [
      `-u${process.env.DB_USER ?? 'root'}`,
      process.env.DB_NAME ?? 'veylog',
      '-e',
      `DELETE FROM rate_limits WHERE bucket_key IN (${list});`,
    ], { stdio: 'pipe' })
  } catch (error) {
    console.log(`  ! could not clear rate buckets (${String(error.message).split('\n')[0]})`)
  }
}

/** Buys, delivers, and writes a review as that buyer. */
async function seedReview({ rating, title, body, author }) {
  // The top featured product is routinely out of stock — earlier suites buy
  // through it — and adding an unavailable variant fails quietly, so the only
  // symptom was "Your bag is empty" at checkout. Scan for a sellable one.
  const listed = await shop('/products?limit=48&sort=featured')
  let variant = null
  let slug = null
  for (const candidate of listed.body.products) {
    const detail = await shop(`/products/${candidate.slug}`)
    const sellable = (detail.body.product.variants ?? []).find((v) => v.in_stock)
    if (sellable) {
      variant = sellable
      slug = candidate.slug
      break
    }
  }
  if (!variant) {
    throw new Error(
      `no product in the catalogue has an in-stock variant — restock one before running this suite ` +
        `(checked ${listed.body.products.length})`,
    )
  }
  void slug
  const phone = `9${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9)}`

  const cart = await shop('/cart', { method: 'POST' })
  const added = await shop(`/cart/${cart.body.cart.token}/items`, {
    method: 'POST',
    body: { variant_id: variant.id, quantity: 1 },
  })
  if (added.status >= 400) {
    throw new Error(`add to cart → ${added.status} ${JSON.stringify(added.body).slice(0, 200)}`)
  }
  const placed = await shop(`/cart/${cart.body.cart.token}/checkout`, {
    method: 'POST',
    body: {
      payment_method: 'cod',
      contact: { first_name: author.split(' ')[0], last_name: 'Buyer', phone, email: `${phone}@example.com` },
      shipping_address: { line1: '8 Brigade Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    },
  })
  if (placed.status >= 400) throw new Error(`checkout → ${placed.status} ${JSON.stringify(placed.body).slice(0, 200)}`)

  const orderId = placed.body.order.id
  for (const status of ['confirmed', 'packed']) {
    await adminOrThrow(`/orders/${orderId}/status`, { method: 'POST', body: { status } })
  }
  await adminOrThrow(`/orders/${orderId}/ship`, { method: 'POST', body: { shipping_mode: 'surface' } })
  await adminOrThrow(`/orders/${orderId}/status`, { method: 'POST', body: { status: 'delivered' } })

  const submitted = await shop(`/products/${slug}/reviews`, {
    method: 'POST',
    body: {
      order_number: placed.body.order.order_number,
      phone,
      rating,
      title,
      body,
      author_name: author,
      author_location: 'Bengaluru',
      usage_duration: 'one_to_four_weeks',
      would_recommend: rating >= 4,
    },
  })
  if (submitted.status >= 400) {
    throw new Error(`review submit → ${submitted.status} ${JSON.stringify(submitted.body).slice(0, 200)}`)
  }
  return { slug, reviewId: submitted.body.review.id, author }
}

const run = async () => {
  mkdirSync(SHOTS, { recursive: true })

  const login = await call(`${API}/admin/api/v1`, '/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  token = login.body.tokens?.access_token ?? login.body.access_token

  clearRateBuckets()

  const ordinary = await seedReview({
    rating: 5,
    title: 'Layers well under sunscreen',
    body: 'Light texture and it sits well under sunscreen. Will buy again.',
    author: 'Ui Reviewer',
  })
  const adverse = await seedReview({
    rating: 1,
    title: 'Stinging and a rash appeared',
    body: 'My face was burning within minutes and I developed a rash.',
    author: 'Ui Reaction',
  })

  console.log(`\nVeylog admin UI — reviews\n\nSeeded reviews ${ordinary.reviewId} and ${adverse.reviewId}\n`)

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(
    existsSync(executablePath)
      ? { executablePath, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] }
      : {},
  )
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
  const page = await context.newPage()
  const main = page.locator('main')

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
  await page.waitForTimeout(1200)

  // ── sidebar ────────────────────────────────────────────────────────────────
  console.log('Sidebar')
  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const link = page.getByRole('navigation').getByRole('link', { name: /^Reviews/ }).first()
  ok('Reviews is enabled in the sidebar', !(await link.innerText()).includes('Soon'))
  ok(
    'and points at /reviews',
    ((await link.getAttribute('href')) ?? '').endsWith('/reviews'),
    await link.getAttribute('href'),
  )

  // ── the queue ──────────────────────────────────────────────────────────────
  console.log('\nThe pending queue')
  // Rows are addressed by the id the API returned, not by their wording. The
  // queue legitimately holds other people's reviews, and an earlier suite's
  // rows are still pending — a text match would pick up either.
  // Flagged reviews sort to the top of the queue by design, and this dev
  // database holds a dozen of them from earlier runs — so the two rows this
  // suite just seeded are not both on the first page of ten. Widen the page
  // rather than assume an ordering the triage rules deliberately override.
  await main.getByRole('combobox', { name: /Rows per page/i }).click()
  await page.getByRole('option', { name: '50' }).click()
  await page.waitForTimeout(1500)

  const row = (id) => main.locator(`[data-review-id="${id}"]`)
  const card = row(ordinary.reviewId)
  const adverseCard = row(adverse.reviewId)

  ok('the page titles itself', (await main.getByRole('heading', { name: 'Reviews' }).count()) === 1)
  ok('the seeded review is waiting', (await card.count()) === 1)
  ok('with its wording', (await card.getByText('Layers well under sunscreen').count()) === 1)
  ok('its provenance is shown', (await card.getByText('Verified purchase').first().isVisible()) === true)
  ok('the adverse one is on screen too', (await adverseCard.count()) === 1)
  ok(
    'and is marked as a possible reaction',
    (await adverseCard.getByText(/possible skin reaction/i).count()) === 1,
  )
  ok(
    'while the ordinary one is not',
    (await card.getByText(/possible skin reaction/i).count()) === 0,
  )
  await page.screenshot({ path: `${SHOTS}/reviews-queue.png`, fullPage: true })

  // A pending review can be approved, rejected or marked spam — never hidden.
  ok('Approve is offered', (await card.getByRole('button', { name: 'Approve' }).count()) === 1)
  ok('Hide is not offered on a pending review', (await card.getByRole('button', { name: 'Hide' }).count()) === 0)
  ok('Reply is not offered before publishing', (await card.getByRole('button', { name: 'Reply' }).count()) === 0)

  // ── rejection needs a reason ───────────────────────────────────────────────
  console.log('\nRejecting needs a reason')
  await card.getByRole('button', { name: 'Reject' }).click()
  await page.waitForTimeout(700)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await page.waitForTimeout(500)
  ok('rejecting with no reason is refused in the dialog', (await dialog.getByText(/Give a reason/i).count()) === 1)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(600)

  // ── approving ──────────────────────────────────────────────────────────────
  console.log('\nApproving publishes it')
  // The count before, not "no rating at all" — the suite is re-runnable, so its
  // own earlier approvals may already be counted against this product.
  const beforeRating = await shop(`/products/${ordinary.slug}/reviews`)
  const countBefore = beforeRating.body.summary.rating_count
  ok(
    'the pending review is not counted while it waits',
    !beforeRating.body.reviews.some((r) => r.title === 'Layers well under sunscreen' && r.id === ordinary.reviewId),
    beforeRating.body.summary,
  )

  await card.getByRole('button', { name: 'Approve' }).click()
  await page.waitForTimeout(700)
  const approveDialog = page.getByRole('dialog')
  ok(
    'the dialog says publishing counts towards the rating',
    (await approveDialog.getByText(/counts it towards/i).count()) === 1,
  )
  await page.screenshot({ path: `${SHOTS}/reviews-approve.png` })
  await approveDialog.getByRole('button', { name: 'Approve' }).click()
  await page.waitForTimeout(2500)

  ok('the dialog closes', (await page.getByRole('dialog').count()) === 0)

  const afterRating = await shop(`/products/${ordinary.slug}/reviews`)
  ok(
    'the review is now public',
    afterRating.body.reviews.some((r) => r.title === 'Layers well under sunscreen'),
    afterRating.body.reviews.length,
  )
  ok('and the product has a rating', afterRating.body.summary.rating_average !== null, afterRating.body.summary)
  ok(
    'which counts one more review than before',
    afterRating.body.summary.rating_count === countBefore + 1,
    { countBefore, after: afterRating.body.summary.rating_count },
  )
  ok(
    'the summary counts match the rows behind them',
    Object.values(afterRating.body.summary.breakdown).reduce((a, b) => a + b, 0) ===
      afterRating.body.summary.rating_count,
    afterRating.body.summary,
  )

  // ── published view ─────────────────────────────────────────────────────────
  console.log('\nThe published view')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Published' }).click()
  await page.waitForTimeout(2000)
  const published = row(ordinary.reviewId)
  ok('it moved to Published', (await published.count()) === 1)
  ok('Reply is now offered', (await published.getByRole('button', { name: 'Reply' }).count()) === 1)
  ok('Approve is no longer offered', (await published.getByRole('button', { name: 'Approve' }).count()) === 0)

  await published.getByRole('button', { name: 'Reply' }).click()
  await page.waitForTimeout(700)
  const replyDialog = page.getByRole('dialog')
  ok('the reply is declared public', (await replyDialog.getByText(/public/i).count()) >= 1)
  // 'Replying as' also contains the word, hence exact.
  await replyDialog.getByLabel('Reply', { exact: true }).fill('Thank you — glad the texture worked for you.')
  await replyDialog.getByRole('button', { name: 'Post reply' }).click()
  await page.waitForTimeout(2200)
  ok('the reply is saved', (await published.getByText(/glad the texture worked/).count()) === 1)

  const withReply = await shop(`/products/${ordinary.slug}/reviews`)
  ok('and reaches the storefront', withReply.body.reviews.some((r) => r.reply !== null), withReply.body.reviews[0]?.reply)

  // ── the safety filter ──────────────────────────────────────────────────────
  console.log('\nThe reaction filter')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Awaiting review' }).click()
  await page.waitForTimeout(1800)
  await main.getByLabel('Possible reactions only').check()
  await page.waitForTimeout(2000)
  ok('the reaction is still listed', (await adverseCard.count()) === 1)
  ok('and every row shown is a flagged one', (await main.getByTestId('review-card').count()) === (await main.getByText(/possible skin reaction/i).count()))
  await page.screenshot({ path: `${SHOTS}/reviews-flagged.png`, fullPage: true })

  // ── console ────────────────────────────────────────────────────────────────
  console.log('\nConsole')
  ok('no console errors across the run', consoleErrors.length === 0, consoleErrors.slice(0, 4))

  await browser.close()
  console.log(`\n${'─'.repeat(56)}\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const failure of failures) console.log(`  • ${failure}`)
  }
  console.log('')
  process.exit(failures.length > 0 ? 1 : 0)
}

run().catch((error) => {
  console.error(`\nFATAL: ${error.message}\n`)
  process.exit(1)
})
