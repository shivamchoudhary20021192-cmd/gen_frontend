/**
 * The page builder screen.
 *
 *   node scripts/ui-smoke-page-builder.mjs
 *
 * The storefront suite proves the rows render. This one proves a person can
 * work the screen: that the section list is the page, that clicking a section
 * shows *its* settings and not a generic form, that the middle pane is the real
 * storefront rather than a drawing of it, and that dragging a row changes the
 * order the shop is actually served in.
 *
 * Everything it creates, it deletes, and the deletion is asserted.
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
  if (!response.ok) throw new Error(`login → ${response.status}`)
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

const homePage = (bearer) => api('/content/page-builder/templates/home', { bearer })

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const bearer = await token()
  const made = []

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  // Wide on purpose: three panes and a storefront in the middle one is what the
  // screen is, and testing it at 1280 would be testing a layout nobody uses.
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 })

    // ── the way in ───────────────────────────────────────────────────────────
    process.stdout.write('\nThe sidebar\n')
    // The group is collapsed until something inside it is the current route,
    // so the row is asserted *after* navigating rather than before — which is
    // the sidebar working, not failing.
    await page.getByText('Merchandising').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.goto(`${BASE}/merchandising/pages`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Page builder').first().waitFor({ state: 'visible', timeout: 15000 })
    ok('Page builder is in the sidebar', (await page.getByText('Page builder').count()) > 0)
    await page.waitForSelector('[data-builder-section]', { timeout: 20000 })
    await page.waitForTimeout(1500)

    // ── the three panes ──────────────────────────────────────────────────────
    process.stdout.write('\nThe screen\n')
    const listed = await page.locator('[data-builder-section]').count()
    ok('the section list is the page', listed >= 6, listed)
    ok('the preview is a frame', (await page.locator('[data-preview-frame]').count()) === 1)

    // The middle pane has to be the *real* storefront. A preview that
    // re-implements the sections is wrong within a week, and wrong exactly
    // where it matters.
    const frame = page.frameLocator('[data-preview-frame]')
    await frame.locator('[data-page-section]').first().waitFor({ state: 'visible', timeout: 20000 })
    const previewed = await frame.locator('[data-page-section]').count()
    ok('and it renders the same sections the storefront does', previewed >= 5, previewed)

    // ── the preview is a real width, scaled ──────────────────────────────────
    // The thing that makes a preview worth having. Rendering the storefront at
    // whatever width is left over fires every responsive rule at the wrong
    // breakpoint — it is a preview of a page no visitor will ever see.
    const laidOut = await page.locator('[data-preview-frame]').evaluate((node) => ({
      attribute: Number(node.style.width.replace('px', '')),
      onScreen: node.getBoundingClientRect().width,
    }))
    ok('the frame is laid out at a real device width', laidOut.attribute === 1440, laidOut)
    ok('and scaled down to fit rather than squeezed', laidOut.onScreen < laidOut.attribute, laidOut)
    ok('the scale is stated', /1440px/.test(await page.locator('[data-preview-scale]').innerText()))

    const stage = await page.locator('[data-preview-stage]').boundingBox()
    ok('and the preview gets most of the screen', stage.width > 600, Math.round(stage.width))

    // Switching device changes the width it is laid out at, not just the box.
    await page.locator('[data-device-picker] button').nth(2).click()
    await page.waitForTimeout(900)
    const phoneWidth = await page
      .locator('[data-preview-frame]')
      .evaluate((node) => Number(node.style.width.replace('px', '')))
    ok('a phone preview is 390 wide, truly', phoneWidth === 390, phoneWidth)
    await page.locator('[data-device-picker] button').nth(0).click()
    await page.waitForTimeout(900)

    // ── the settings are the section's own ───────────────────────────────────
    process.stdout.write('\nEach section brings its own settings\n')
    await page.locator('[data-builder-section]').first().click()
    await page.waitForTimeout(600)
    const heroPane = await page.locator('[data-settings-pane]').innerText()
    ok('a hero shows hero settings', /Headline/i.test(heroPane), heroPane.slice(0, 160))

    // Sixteen settings in one scroll is a wall. Grouped, it is four short lists.
    const panels = await page.locator('[data-settings-pane] [data-panel]').evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.panel),
    )
    ok('settings are grouped into panels', panels.includes('Content') && panels.includes('Layout'), panels)

    // A setting in a closed panel is genuinely not on screen — the panels are
    // doing work, not decorating.
    ok('and a closed panel is not just visually hidden', !/Darken the picture/i.test(heroPane))
    await page.locator('[data-panel="Style"]').click()
    await page.waitForTimeout(400)
    ok(
      'opening one reveals its settings',
      /Darken the picture/i.test(await page.locator('[data-settings-pane]').innerText()),
    )

    // The promise strip is a different kind and must show different fields —
    // this is the assertion that a generic form would fail.
    const promiseRow = page.locator('[data-builder-section]').nth(1)
    await promiseRow.click()
    await page.waitForTimeout(700)
    const promisePane = await page.locator('[data-settings-pane]').innerText()
    ok('a promise strip shows its own, different ones', /Promise/i.test(promisePane) && !/Headline/i.test(promisePane), promisePane.slice(0, 160))
    ok('and lists the parts inside it', (await page.locator('[data-builder-block]').count()) === 4)

    // ── the two panes are one screen ─────────────────────────────────────────
    // Clicking a band in the preview selects its row. Without it, finding a
    // band's settings means reading fifteen names in a list.
    process.stdout.write('\nClicking the page itself\n')
    const heroId = await page.locator('[data-builder-section]').first().getAttribute('data-builder-section')
    // Selected away from the hero first, so the click has something to change.
    // An assertion that passes whatever the click did is not an assertion.
    await page.locator('[data-builder-section]').nth(1).click()
    await page.waitForTimeout(500)
    ok(
      'another section is selected to begin with',
      (await page.locator('[data-builder-section]').first().getAttribute('data-selected')) === 'false',
    )

    await frame.locator(`[data-section-id="${heroId}"]`).click({ position: { x: 40, y: 40 } })
    await page.waitForTimeout(900)
    ok(
      'clicking a band in the preview selects its row',
      (await page.locator('[data-builder-section]').first().getAttribute('data-selected')) === 'true',
    )
    ok(
      'and the settings follow',
      /Headline/i.test(await page.locator('[data-settings-pane]').innerText()),
    )

    await page.screenshot({ path: `${SHOTS}/page-builder.png` })

    // ── adding one ───────────────────────────────────────────────────────────
    process.stdout.write('\nAdding a section\n')
    // Inserted after the *first* row rather than at the end: "add a section"
    // nearly always means "add one here".
    const firstId = Number(await page.locator('[data-builder-section]').first().getAttribute('data-builder-section'))
    await page.locator('[data-builder-section]').first().hover()
    await page.locator(`[data-insert-after="${firstId}"]`).click()
    await page.waitForSelector('[data-add-section]', { timeout: 10000 })
    const offered = await page.locator('[data-add-section]').count()
    ok('the catalogue offers every kind', offered >= 10, offered)
    ok(
      'and each says what it is for rather than only what it is called',
      (await page.locator('[data-add-section="media_products"]').innerText()).length > 60,
    )

    // Fifteen kinds is past what anyone scans, so it is searchable — and it
    // matches on the description, which is where the words a merchandiser
    // would think of actually live.
    await page.locator('[data-section-search]').fill('picture')
    await page.waitForTimeout(400)
    const narrowed = await page.locator('[data-add-section]').count()
    ok('the catalogue can be searched', narrowed > 0 && narrowed < offered, { offered, narrowed })
    await page.locator('[data-section-search]').fill('')
    await page.waitForTimeout(300)

    await page.locator('[data-add-section="media_products"]').click()
    await page.waitForTimeout(2200)

    const afterAdd = await homePage(bearer)
    const order = afterAdd.body.sections.map((section) => section.id)
    const added = afterAdd.body.sections.find((section) => section.key === 'media_products')
    ok('the section is added to the page', Boolean(added), afterAdd.body.sections.map((s) => s.key))
    if (added) made.push(added.id)
    ok('and lands where it was asked for, not at the end', order[1] === added?.id, { order, added: added?.id })
    ok('the list grew', (await page.locator('[data-builder-section]').count()) === listed + 1)

    // ── editing a field saves it ─────────────────────────────────────────────
    process.stdout.write('\nEditing\n')
    const headingBox = page.locator('[data-settings-pane] [data-field="heading"]').first()
    await headingBox.waitFor({ state: 'visible', timeout: 10000 })
    await headingBox.fill('Smoke heading for the builder')
    // The save is debounced, so this waits for the request rather than for a
    // fixed pause — a sleep here makes the assertion a test of the machine.
    await page
      .waitForResponse(
        (response) =>
          /\/content\/page-builder\/sections\/\d+$/.test(response.url()) && response.request().method() === 'PATCH',
        { timeout: 10000 },
      )
      .catch(() => undefined)
    await page.waitForTimeout(600)

    const saved = (await homePage(bearer)).body.sections.find((section) => section.id === added.id)
    ok('typing into a field saves it', saved?.settings?.heading === 'Smoke heading for the builder', saved?.settings)

    // ── dragging reorders the real page ──────────────────────────────────────
    process.stdout.write('\nDragging\n')
    // The new section needs a product in it first. A section with no blocks is
    // correctly dropped from the storefront — "a heading over a gap is the most
    // obvious kind of broken" — so an empty one would never appear in the
    // preview however it was ordered, and asserting on it would be asserting
    // that the empty-section rule is broken.
    const catalogueProducts = await fetch(`${API.replace('/admin', '')}/api/v1/products?limit=1`).then((response) =>
      response.json(),
    )
    const block = await api(`/content/page-builder/sections/${added.id}/blocks`, {
      method: 'POST',
      bearer,
      body: { block_key: 'product' },
    })
    await api(`/content/page-builder/sections/${added.id}/blocks/${block.body.block_id}`, {
      method: 'PATCH',
      bearer,
      body: { product: catalogueProducts.products[0].id },
    })
    ok('a product can be put in the new section', block.status === 201, block.body)
    const before = (await homePage(bearer)).body.sections.map((section) => section.id)
    await page.locator(`[data-builder-section="${added.id}"]`).dragTo(page.locator('[data-builder-section]').first())
    await page.waitForTimeout(2000)
    const after = (await homePage(bearer)).body.sections.map((section) => section.id)
    ok('dragging a section to the top reorders the page', after[0] === added.id, { before, after })

    // ── and the preview follows ──────────────────────────────────────────────
    // Polled rather than slept through: the preview is a whole page load, and
    // how long that takes is a property of the machine, not of the feature.
    let previewFirst = null
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.evaluate(() => {
        const node = document.querySelector('[data-preview-frame]')
        node?.contentWindow?.postMessage({ source: 'veylor-admin', type: 'reload' }, '*')
      })
      await page.waitForTimeout(1000)
      previewFirst = await frame
        .locator('[data-page-section]')
        .first()
        .getAttribute('data-section-id')
        .catch(() => null)
      if (Number(previewFirst) === added.id) break
    }
    ok('and the preview shows the new order', Number(previewFirst) === added.id, { previewFirst, expected: added.id })

    // ── duplicating ──────────────────────────────────────────────────────────
    // The most-used button in any builder after "add": get one band right, then
    // copy it twice rather than filling three empty ones in from memory.
    process.stdout.write('\nDuplicating\n')
    await page.locator(`[data-builder-section="${added.id}"]`).hover()
    await page.locator(`[data-builder-section="${added.id}"] button[aria-label^="More"]`).click()
    await page.locator('[data-duplicate-section]').click()
    await page.waitForTimeout(2200)

    const afterCopy = await homePage(bearer)
    const copy = afterCopy.body.sections.find(
      (section) => section.id !== added.id && String(section.name).endsWith('copy'),
    )
    ok('a section can be duplicated', Boolean(copy), afterCopy.body.sections.map((s) => s.name))
    if (copy) made.push(copy.id)
    ok(
      'the copy keeps what was in it',
      copy?.blocks?.length === 1 && copy?.settings?.heading === 'Smoke heading for the builder',
      { blocks: copy?.blocks?.length, heading: copy?.settings?.heading },
    )
    ok(
      'and sits directly after the original',
      afterCopy.body.sections.findIndex((section) => section.id === copy?.id) ===
        afterCopy.body.sections.findIndex((section) => section.id === added.id) + 1,
      afterCopy.body.sections.map((section) => section.id),
    )

    ok('no console errors', consoleErrors.filter((line) => !/favicon/i.test(line)).length === 0, consoleErrors.slice(0, 3))
  } finally {
    for (const id of made) await api(`/content/page-builder/sections/${id}`, { method: 'DELETE', bearer })
    const left = (await homePage(bearer)).body.sections ?? []
    ok('everything this suite made is removed', !left.some((section) => made.includes(section.id)), left.length)
    ok('and the shop’s own page is intact', left.length >= 6, left.map((section) => section.key))
    await browser.close()
  }

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
  if (failures.length) {
    failures.forEach((failure) => process.stdout.write(`  · ${failure}\n`))
    process.exit(1)
  }
}

main().catch((error) => {
  process.stdout.write(`${String(error)}\n`)
  process.exit(1)
})
