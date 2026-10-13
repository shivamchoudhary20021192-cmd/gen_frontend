/**
 * Headless click-through of story sections — the library, the editor, the
 * hotspot pinner, and attaching a section to a product.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-sections.mjs
 *
 * The claims worth proving:
 *
 *   * the sidebar reaches Story sections (a menu row alone greys out — the
 *     route registry has to carry the key too)
 *   * a section can be written, renamed, and given blocks
 *   * blocks reorder, and the order survives a reload
 *   * hotspots are stored as percentages and come back where they were put
 *   * a section attaches to a product, toggles, reorders and detaches
 *   * a section still on a product cannot be deleted out from under it
 *
 * Everything it makes, it removes.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { clickNav, expandAllGroups } from './lib/sidebar.mjs'

const BASE = (process.env.UI_BASE ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const API = process.env.API_BASE ?? 'http://127.0.0.1:4000'
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

// A token lasts fifteen minutes; this suite can run longer, and a 401 swallowed
// during tidy-up is how a run leaves its scratch section behind.
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

const stamp = Date.now().toString(36).toUpperCase().slice(-5)
const NAME = `Smoke section ${stamp}`

const run = async () => {
  const token = await adminToken()
  let sectionId = null
  let productId = null
  let assignmentId = null

  console.log('\nVeylog admin UI — story sections\n')

  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

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
  await page.waitForTimeout(1500)

  try {
    // ── the sidebar reaches it ──────────────────────────────────────────────
    console.log('Sidebar')
    await expandAllGroups(page)
    await page.waitForTimeout(600)
    const nav = page.getByRole('navigation').first()
    const link = nav.getByRole('link', { name: 'Story sections' }).first()
    const href = await link.getAttribute('href').catch(() => null)
    ok(
      'Story sections is a live link, not a greyed-out row',
      href === '/content/sections',
      href === null ? 'no anchor — the route registry is missing content.sections' : String(href),
    )

    await clickNav(page, 'Story sections')
    await page.waitForURL('**/content/sections', { timeout: 15000 })
    await page.waitForTimeout(800)

    // ── writing one ─────────────────────────────────────────────────────────
    console.log('\nWriting a section')
    await page.getByPlaceholder('Pocket Pearl packaging').first().fill(NAME)
    await page.getByRole('button', { name: 'Write it' }).click()
    await page.waitForURL(/\/content\/sections\/\d+$/, { timeout: 15000 })
    sectionId = Number(page.url().match(/\/(\d+)$/)?.[1])
    ok('writing a section opens its editor', Number.isInteger(sectionId) && sectionId > 0, page.url())

    await page.waitForTimeout(800)
    await page.getByLabel('Heading').first().fill('less harm, more pearl.')
    await page.getByLabel('Standfirst').first().fill('Made with post-consumer recycled materials.')
    // Section fields save on blur rather than behind a button.
    await page.getByLabel('Footnote').first().click()
    await page.waitForTimeout(1200)

    const afterHeading = await api(`/content/sections/${sectionId}`, { token })
    ok(
      'the heading saves on blur',
      afterHeading.body?.section?.heading === 'less harm, more pearl.',
      JSON.stringify(afterHeading.body?.section?.heading),
    )

    // ── blocks ──────────────────────────────────────────────────────────────
    console.log('\nBlocks')
    for (const kind of ['Stat', 'Feature']) {
      await page.getByLabel('Block kind').click()
      await page.getByRole('option', { name: new RegExp(`^${kind} —`) }).click()
      await page.getByRole('button', { name: 'Add block' }).click()
      await page.waitForTimeout(1000)
    }
    let detail = (await api(`/content/sections/${sectionId}`, { token })).body?.section
    ok('two blocks added', detail?.blocks?.length === 2, `blocks: ${detail?.blocks?.length}`)

    const firstBlockId = detail?.blocks?.[0]?.id
    const secondBlockId = detail?.blocks?.[1]?.id

    // Fill the first block so the reorder below is visible rather than a guess.
    await page.locator(`[data-block-id="${firstBlockId}"]`).getByLabel('Heading').fill('100%')
    await page.locator(`[data-block-id="${firstBlockId}"]`).getByLabel('Body').click()
    await page.waitForTimeout(1200)
    detail = (await api(`/content/sections/${sectionId}`, { token })).body?.section
    ok(
      'a block heading saves',
      detail?.blocks?.find((b) => b.id === firstBlockId)?.heading === '100%',
      JSON.stringify(detail?.blocks?.[0]?.heading),
    )

    // ── reorder ─────────────────────────────────────────────────────────────
    console.log('\nReordering')
    await page.locator(`[data-block-id="${secondBlockId}"]`).getByLabel('Move up').click()
    await page.waitForTimeout(1200)
    detail = (await api(`/content/sections/${sectionId}`, { token })).body?.section
    ok(
      'moving a block up persists',
      detail?.blocks?.[0]?.id === secondBlockId,
      `order: ${detail?.blocks?.map((b) => b.id).join(',')}`,
    )

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const domOrder = await page.locator('[data-block-id]').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-block-id'))),
    )
    ok(
      'the new order survives a reload',
      domOrder[0] === secondBlockId,
      `dom: ${domOrder.join(',')}`,
    )

    // ── hotspots ────────────────────────────────────────────────────────────
    // Pinned through the API rather than the dialog: the editor needs a picture
    // to pin onto, and a media upload is a different suite's job. What is being
    // proved here is that percentages survive the round trip — a pin stored as
    // pixels lands on the wrong part of the cap at any other screen width.
    console.log('\nHotspots')

    const bare = await api(`/content/sections/${sectionId}/blocks/${firstBlockId}/hotspots`, {
      method: 'PUT',
      token,
      body: { hotspots: [{ x_pct: 10, y_pct: 10, label: 'Cap' }] },
    })
    ok(
      'pinning a block with no picture is refused, with a reason',
      bare.status === 409 && /image/i.test(bare.body?.error?.message ?? bare.body?.message ?? ''),
      `status ${bare.status} ${JSON.stringify(bare.body).slice(0, 140)}`,
    )

    const image = (await api('/media?limit=1&type=image', { token })).body
    const mediaId = image?.data?.[0]?.id ?? image?.media?.[0]?.id
    await api(`/content/sections/${sectionId}/blocks/${firstBlockId}`, {
      method: 'PATCH',
      token,
      body: { media_id: mediaId },
    })

    const pinned = await api(`/content/sections/${sectionId}/blocks/${firstBlockId}/hotspots`, {
      method: 'PUT',
      token,
      body: {
        hotspots: [
          { x_pct: 24.5, y_pct: 71.25, label: 'Cap', body: '50% PCR', line_direction: 'left' },
        ],
      },
    })
    const spot = pinned.body?.section?.blocks?.find((b) => b.id === firstBlockId)?.hotspots?.[0]
    ok('a hotspot saves', pinned.status === 200 && spot?.label === 'Cap', `status ${pinned.status}`)
    ok(
      'its coordinates come back as the percentages they went in as',
      Number(spot?.x) === 24.5 && Number(spot?.y) === 71.25,
      `${spot?.x},${spot?.y}`,
    )

    const replaced = await api(`/content/sections/${sectionId}/blocks/${firstBlockId}/hotspots`, {
      method: 'PUT',
      token,
      body: { hotspots: [] },
    })
    ok(
      'saving an empty set clears the pins',
      replaced.body?.section?.blocks?.find((b) => b.id === firstBlockId)?.hotspots?.length === 0,
    )

    // ── attaching to a product ──────────────────────────────────────────────
    console.log('\nOn a product')
    const products = await api('/products?limit=1', { token })
    productId = products.body?.data?.[0]?.id ?? products.body?.products?.[0]?.id
    ok('there is a product to attach to', Boolean(productId), JSON.stringify(products.body).slice(0, 160))

    if (productId) {
      await page.goto(`${BASE}/products/${productId}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      const card = page.locator('text=Story sections').first()
      ok('the product form shows a Story sections card', await card.isVisible().catch(() => false))

      // With nothing chosen the control must still say what it is for. A
      // select ignores `placeholder`, so this rendered as an empty box: it
      // looks like a dead control, never gets opened, and the product page
      // silently never gets its story.
      ok(
        'the unchosen picker tells you to choose a section',
        (await page.getByText('Choose a section').count()) > 0,
        'the select renders blank — nothing says it holds anything',
      )

      await page.getByLabel('Attach a section').click()
      await page.getByRole('option', { name: new RegExp(NAME) }).click()
      await page.getByRole('button', { name: 'Attach' }).click()
      await page.waitForTimeout(1500)

      let onProduct = (await api(`/products/${productId}/sections`, { token })).body?.sections ?? []
      const mine = onProduct.find((row) => row.id === sectionId)
      assignmentId = mine?.assignment_id
      ok('attaching puts the section on the product', Boolean(assignmentId), JSON.stringify(onProduct.map((r) => r.name)))

      // The library should no longer offer what is already on.
      await page.getByLabel('Attach a section').click()
      const stillOffered = await page
        .getByRole('option', { name: new RegExp(NAME) })
        .count()
        .catch(() => 0)
      await page.keyboard.press('Escape')
      ok('an attached section is not offered again', stillOffered === 0, `offered ${stillOffered}×`)

      // Toggling off should hide it from the storefront, not detach it.
      // `switch`, not `checkbox`: this MUI gives the input role="switch".
      await page.locator(`[data-assignment-id="${assignmentId}"]`).getByRole('switch').click()
      await page.waitForTimeout(1200)
      onProduct = (await api(`/products/${productId}/sections`, { token })).body?.sections ?? []
      ok(
        'switching it off hides it without detaching it',
        onProduct.find((row) => row.assignment_id === assignmentId)?.is_enabled === false,
      )

      // A section in use must not be deletable — the alternative is a block of
      // copy vanishing off a live product page.
      const refused = await api(`/content/sections/${sectionId}`, { method: 'DELETE', token })
      ok(
        'a section still on a product refuses to be deleted',
        refused.status >= 400,
        `status ${refused.status}`,
      )

      await page.locator(`[data-assignment-id="${assignmentId}"]`).getByLabel(/^Detach /).click()
      await page.waitForTimeout(1500)
      onProduct = (await api(`/products/${productId}/sections`, { token })).body?.sections ?? []
      ok(
        'detaching takes it off the product',
        !onProduct.some((row) => row.assignment_id === assignmentId),
      )
      assignmentId = null

      const survives = await api(`/content/sections/${sectionId}`, { token })
      ok('but the section itself survives in the library', survives.status === 200)

      // An empty library used to render as a picker with nothing in it and no
      // explanation — which reads as a broken control rather than as "nothing
      // has been written yet", and leaves the person with nowhere to go.
      await page.route('**/admin/api/v1/content/sections*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sections: [] }),
        }),
      )
      await page.reload({ waitUntil: 'networkidle' })
      // Waited for, not slept through. A fixed pause raced the query on a busy
      // machine and failed about one run in three — a test that fails at random
      // teaches everyone to re-run it rather than read it.
      const wayOut = page.getByRole('button', { name: 'Write the first one' })
      await wayOut.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined)
      ok('an empty library explains itself and offers a way out', (await wayOut.count()) === 1)
      await page.unroute('**/admin/api/v1/content/sections*')
    }

    // ── the console ─────────────────────────────────────────────────────────
    console.log('\nConsole')
    const noise = consoleErrors.filter(
      (text) =>
        !text.includes('Failed to load resource') &&
        !text.includes('status of 409') &&
        !text.includes('status of 422'),
    )
    ok('no React or runtime errors on the console', noise.length === 0, noise.slice(0, 3).join('\n      '))
  } finally {
    // ── tidy up ─────────────────────────────────────────────────────────────
    if (productId && assignmentId) {
      await api(`/products/${productId}/sections/${assignmentId}`, { method: 'DELETE', token })
    }
    if (sectionId) {
      const removed = await api(`/content/sections/${sectionId}`, { method: 'DELETE', token })
      ok('the scratch section is cleaned up', removed.status === 200, `status ${removed.status}`)
    }
    await browser.close()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log(failures.map((f) => `  · ${f}`).join('\n'))
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
