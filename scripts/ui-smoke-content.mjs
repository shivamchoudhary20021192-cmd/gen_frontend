/**
 * Headless click-through of the Content module in the admin.
 *
 *   npm run dev        # vite on 5173, proxying to the API on 4000
 *   node scripts/ui-smoke-content.mjs
 *
 * Content had a full admin API and four working screens that nothing could
 * reach: every menu row under Content sat at 'coming_soon', so the whole group
 * rendered greyed out and the screens were only reachable by typing the URL.
 * Journal was worse — a placeholder that said "coming soon" in the page body.
 *
 * So the claims worth proving here are the boring structural ones:
 *
 *   * the Content group is reachable from the sidebar, and its rows are links
 *   * Pages, Banners and FAQs load real data rather than an empty shell
 *   * the Journal writes, saves and publishes an article end to end
 *   * publishing refuses an article with no excerpt, and says why
 *   * Blogs adds, renames and deletes a publication, and a delete moves the
 *     articles in it rather than taking them with it
 */
import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
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
  if (!response.ok) throw new Error(`admin login → ${response.status} ${JSON.stringify(body).slice(0, 200)}`)
  return body.access_token ?? body.tokens?.access_token
}

/**
 * An admin access token lasts fifteen minutes and this suite runs longer than
 * that, so a call made near the end — the tidy-up, in particular — would come
 * back 401 and be thrown away without a word. That is how a run ends up leaving
 * a published article behind. A 401 therefore buys a fresh token and retries
 * once, rather than being quietly swallowed.
 */
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
const TITLE = `Smoke article ${stamp}`

const run = async () => {
  const token = await adminToken()

  console.log('\nVeylog admin UI — content\n')

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

  // ── the sidebar reaches it ────────────────────────────────────────────────
  console.log('Sidebar')
  await expandAllGroups(page)
  await page.waitForTimeout(600)
  const nav = page.getByRole('navigation').first()

  for (const label of ['Pages', 'Journal', 'Blogs', 'Banners', 'FAQs', 'Creators']) {
    const link = nav.getByRole('link', { name: label }).first()
    const href = await link.getAttribute('href').catch(() => null)
    ok(
      `${label} is a live link, not a greyed-out "Soon"`,
      Boolean(href),
      href === null ? 'no anchor — the menu row is still coming_soon' : href,
    )
  }

  // ── the three screens that already existed ────────────────────────────────
  console.log('\nPages, Banners, FAQs')
  const livePages = (await api('/content/pages?limit=50', { token })).body
  const pageRows = livePages?.data?.length ?? livePages?.pages?.length ?? 0

  await clickNav(page, 'Pages')
  await page.waitForURL('**/content/pages', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the pages list opens', page.url().endsWith('/content/pages'))
  const pagesOnScreen = await page.locator('main table tbody tr').count()
  ok(
    'and shows the pages the API returned rather than an empty shell',
    pagesOnScreen > 0 && pageRows > 0,
    `${pagesOnScreen} rows on screen, ${pageRows} from the API`,
  )

  await clickNav(page, 'Banners')
  await page.waitForURL('**/content/banners', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the banners list opens', page.url().endsWith('/content/banners'))

  await clickNav(page, 'FAQs')
  await page.waitForURL('**/content/faqs', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the FAQs list opens', page.url().endsWith('/content/faqs'))

  const main = page.locator('main')

  // ── the banner edit form hydrates ─────────────────────────────────────────
  //
  // Every banner endpoint answers `{ success, data }`, and the single-entity
  // API calls used to type the response as the banner itself — so the form was
  // handed the envelope. It opened blank, with "Invalid Date" and an "Inactive"
  // chip on a banner that was active. Asserted against what the API returned
  // rather than fixed wording.
  console.log('\nBanner edit form')
  const made = await api('/content/banners', {
    method: 'POST',
    token,
    body: {
      name: `Smoke banner ${stamp}`,
      placement: 'home_hero',
      title: `Headline ${stamp}`,
      subtitle: 'Subtitle line',
      body: '<p>Body written in the editor.</p>',
      priority: 7,
    },
  })
  const bannerId = made.body?.data?.id ?? made.body?.id
  ok('a banner can be created', Boolean(bannerId), String(made.status))

  if (bannerId) {
    const expected = (await api(`/content/banners/${bannerId}`, { token })).body?.data ?? {}
    await page.goto(`${BASE}/content/banners/${bannerId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    const valueOf = (label) =>
      main.getByRole('textbox', { name: label }).first().inputValue().catch(() => '')

    ok('the name is filled in', (await valueOf(/^Name/)) === expected.name, await valueOf(/^Name/))
    ok('the title is filled in', (await valueOf(/^Title/)) === expected.title, await valueOf(/^Title/))
    ok('the subtitle is filled in', (await valueOf(/^Subtitle/)) === expected.subtitle)
    ok(
      'the body reaches the editor',
      (await main.locator('.ProseMirror').first().innerText()).includes('Body written in the editor'),
    )
    ok('the dates are real, not "Invalid Date"', !(await main.innerText()).includes('Invalid Date'))
    ok(
      'an active banner does not show as Inactive',
      !(await main.innerText()).includes('Inactive'),
    )

    // The API refuses to delete an active banner, so deactivate first —
    // otherwise this suite quietly leaves its test banners on the live site.
    await api(`/content/banners/${bannerId}`, { method: 'PUT', token, body: { is_active: false } })
    await api(`/content/banners/${bannerId}`, { method: 'DELETE', token })
  }

  // ── a video in a banner ───────────────────────────────────────────────────
  // The brand shoots campaign film, so the banner slot has to take video. The
  // failure this pins down is a specific one: the library and the form both
  // used to assume every file was an image, which drew a generic icon in the
  // grid and a broken-image placeholder in the form.
  console.log('\nVideo in the media library')

  const clipBytes = readFileSync(new URL('./fixtures/smoke-clip.webm', import.meta.url))
  const clipForm = new FormData()
  clipForm.append('files', new Blob([clipBytes], { type: 'video/webm' }), 'smoke-clip.webm')
  const clipUpload = await fetch(`${API}/admin/api/v1/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: clipForm,
  })
  const clipMedia = (await clipUpload.json().catch(() => ({}))).media?.[0]
  ok('a video uploads to the library', Boolean(clipMedia?.id), String(clipUpload.status))
  ok('and is stored as video', clipMedia?.media_type === 'video', clipMedia?.media_type)

  // The still is generated after the response comes back.
  let clipReady = clipMedia
  for (let attempt = 0; attempt < 10 && !clipReady?.poster_url; attempt += 1) {
    await page.waitForTimeout(600)
    clipReady = (await api(`/media/${clipMedia?.id}`, { token })).body?.media
  }
  ok('a frame is taken out of it', Boolean(clipReady?.poster_url), 'no poster — is ffmpeg installed?')

  if (clipMedia?.id) {
    // Navigated by clicking, not by URL: in dev the vite proxy owns /media and
    // a hard visit to it reaches the API rather than the admin.
    await page.getByRole('link', { name: 'Media' }).first().click()
    await page.waitForURL('**/media', { timeout: 15000 })
    await page.waitForTimeout(2500)

    const tile = main.locator(`[aria-label="smoke-clip.webm"], [aria-label="smoke-clip"]`).first()
    const tileImages = await main.locator('img').count()
    ok(
      'the library shows films as pictures rather than as a file icon',
      tileImages > 0,
      `${tileImages} images in the grid`,
    )
    if ((await tile.count()) === 1) {
      ok('the new film has a still of its own', (await tile.locator('img').count()) === 1)
      ok('and says how long it runs', (await tile.getByText(/^\d+:\d\d$/).count()) === 1)
    }

    // ── the banner form ─────────────────────────────────────────────────────
    const filmBanner = await api('/content/banners', {
      method: 'POST',
      token,
      body: {
        name: `Smoke film ${stamp}`,
        placement: 'home_hero',
        title: `Film ${stamp}`,
        desktop_media_id: clipMedia.id,
        priority: 5,
      },
    })
    const filmBannerId = filmBanner.body?.data?.id ?? filmBanner.body?.id
    ok('a banner can be given a video', Boolean(filmBannerId), String(filmBanner.status))

    if (filmBannerId) {
      await page.goto(`${BASE}/content/banners/${filmBannerId}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      ok('the form plays the film rather than showing a broken image', (await page.locator('video').count()) >= 1)
      ok(
        'and offers the frame it picked as the poster',
        (await page.getByText('Poster Image (Optional)').count()) === 1,
      )
      ok(
        'with a way to choose a different one',
        (await page.getByRole('button', { name: /Choose a different frame|Change poster/ }).count()) === 1,
      )

      await api(`/content/banners/${filmBannerId}`, { method: 'PUT', token, body: { is_active: false } })
      await api(`/content/banners/${filmBannerId}`, { method: 'DELETE', token })
    }

    await api(`/media/${clipMedia.id}`, { method: 'DELETE', token })
  }

  // ── creators ──────────────────────────────────────────────────────────────
  // The library the model looks draw on. What is worth pinning is that an
  // outbound link somebody typed is refused unless it is a real http(s)
  // address — an href is where a `javascript:` URL becomes a stored script —
  // and that removing someone does not strip her out of looks already
  // published.
  console.log('\nCreators')
  await clickNav(page, 'Creators')
  await page.waitForURL('**/content/creators', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the creators library opens', page.url().endsWith('/content/creators'))

  const creatorsBefore = (await api('/creators', { token })).body?.creators ?? []

  await main.getByRole('button', { name: /Add a person/i }).click()
  await page.waitForTimeout(900)
  const creatorDialog = page.getByRole('dialog')
  ok('the form opens', (await creatorDialog.count()) === 1)

  const CREATOR = `Smoke Model ${stamp}`
  await creatorDialog.getByRole('textbox', { name: 'Name' }).fill(CREATOR)
  await creatorDialog.getByRole('textbox', { name: 'Handle' }).fill('smokemodel')
  await creatorDialog.getByRole('textbox', { name: 'Instagram' }).fill('javascript:alert(1)')
  await creatorDialog.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(1500)
  ok(
    'a link that is not a real address is refused, and says which field',
    (await creatorDialog.getByRole('alert').innerText().catch(() => '')).toLowerCase().includes('instagram'),
  )

  await creatorDialog.getByRole('textbox', { name: 'Instagram' }).fill('https://instagram.com/smokemodel')
  await creatorDialog.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(2000)

  const creatorsAfter = (await api('/creators', { token })).body?.creators ?? []
  const newCreator = creatorsAfter.find((person) => person.name === CREATOR)
  ok('a person can be added', Boolean(newCreator), JSON.stringify(creatorsAfter.map((c) => c.name)))
  ok('the handle is stored with exactly one @', newCreator?.handle === '@smokemodel', newCreator?.handle)
  ok('and the list grew by one', creatorsAfter.length === creatorsBefore.length + 1)
  ok(
    'the new person is on screen without a reload',
    (await main.locator(`[data-creator-id="${newCreator?.id}"]`).count()) === 1,
  )

  if (newCreator?.id) {
    await api(`/creators/${newCreator.id}`, { method: 'DELETE', token })
  }

  // ── the rich text editor loads what was saved ─────────────────────────────
  //
  // Tiptap only takes its content at construction, so a body fetched after the
  // editor mounts has to be pushed in — and the editor was announcing its own
  // empty document *after* that push, overwriting it. The field opened blank
  // while every plain input beside it was filled, on every screen that uses it.
  //
  // Checked on all three consumers, because the failure looked identical on
  // each and had two different causes: a write-back race on banners and the
  // journal, and camelCase-vs-snake_case field names on pages.
  console.log('\nRich text editors')

  const bodies = [
    {
      label: 'banner',
      create: () =>
        api('/content/banners', {
          method: 'POST',
          token,
          body: {
            name: `Smoke editor ${stamp}`,
            placement: 'home_hero',
            body: `<h1>Heading ${stamp}</h1><p>Paragraph body.</p>`,
          },
        }),
      idOf: (r) => r.body?.data?.id ?? r.body?.id,
      url: (id) => `/content/banners/${id}`,
      cleanup: async (id) => {
        await api(`/content/banners/${id}`, { method: 'PUT', token, body: { is_active: false } })
        await api(`/content/banners/${id}`, { method: 'DELETE', token })
      },
    },
    {
      label: 'page',
      create: () =>
        api('/content/pages', {
          method: 'POST',
          token,
          body: {
            slug: `smoke-editor-${stamp.toLowerCase()}`,
            title: `Smoke editor page ${stamp}`,
            page_type: 'standard',
            body_html: `<h1>Heading ${stamp}</h1><p>Paragraph body.</p>`,
          },
        }),
      idOf: (r) => r.body?.data?.id ?? r.body?.id,
      url: (id) => `/content/pages/${id}`,
      cleanup: (id) => api(`/content/pages/${id}`, { method: 'DELETE', token }),
    },
    {
      label: 'article',
      create: () =>
        api('/content/articles', {
          method: 'POST',
          token,
          body: {
            title: `Smoke editor article ${stamp}`,
            body_html: `<h1>Heading ${stamp}</h1><p>Paragraph body.</p>`,
          },
        }),
      idOf: (r) => r.body?.article?.id,
      url: (id) => `/content/articles/${id}`,
      cleanup: (id) => api(`/content/articles/${id}`, { method: 'DELETE', token }),
    },
  ]

  for (const subject of bodies) {
    const created = await subject.create()
    const id = subject.idOf(created)
    if (!id) {
      ok(`a ${subject.label} can be created`, false, `${created.status} ${JSON.stringify(created.body).slice(0, 120)}`)
      continue
    }

    await page.goto(`${BASE}${subject.url(id)}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)

    const editor = main.locator('.ProseMirror').first()
    const text = await editor.innerText().catch(() => '')
    ok(`the ${subject.label} editor shows the saved body`, text.includes(`Heading ${stamp}`), JSON.stringify(text.slice(0, 60)))
    ok(`the ${subject.label} editor keeps the heading markup`, (await editor.locator('h1').count()) === 1)

    await subject.cleanup(id)
  }

  // ── the journal ───────────────────────────────────────────────────────────
  console.log('\nJournal')
  await clickNav(page, 'Journal')
  await page.waitForURL('**/content/articles', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the journal opens', page.url().endsWith('/content/articles'))
  ok(
    'it is a real screen, not a "coming soon" placeholder',
    (await main.getByText(/coming soon/i).count()) === 0,
  )
  ok('it offers a way to write one', (await main.getByRole('button', { name: /Write an article/i }).count()) === 1)

  await main.getByRole('button', { name: /Write an article/i }).click()
  await page.waitForURL('**/content/articles/new', { timeout: 15000 })
  await page.waitForTimeout(1500)

  // Not { exact: true }: MUI appends " *" to a required field's label, so an
  // exact match never finds it.
  await page.getByRole('textbox', { name: /^Title/ }).first().fill(TITLE)
  await page.getByRole('textbox', { name: /^Subtitle/ }).first().fill('Written by the content smoke suite.')

  // Tiptap renders a contenteditable rather than a textarea, so the body is
  // typed into the editor surface the way a person would.
  const editor = page.locator('.ProseMirror').first()
  await editor.click()
  await editor.type('This paragraph exists so the article has a body to publish.')
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForURL(/\/content\/articles\/\d+$/, { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('saving a new article lands on the saved record', /\/content\/articles\/\d+$/.test(page.url()), page.url())

  const articleId = Number(page.url().split('/').pop())
  const saved = (await api(`/content/articles/${articleId}`, { token })).body?.article
  ok('the title was stored', saved?.title === TITLE, saved?.title)
  ok('the body was stored', Boolean(saved?.body_html && saved.body_html.length > 20))
  ok('a read time was worked out from the body', Number(saved?.read_time_minutes ?? 0) >= 1, String(saved?.read_time_minutes))
  ok('the handle was made from the title', Boolean(saved?.slug), saved?.slug)

  // ── publishing refuses an article with no excerpt ─────────────────────────
  console.log('\nPublishing')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.waitForTimeout(2000)
  ok(
    'publishing without an excerpt is refused, with the reason on screen',
    (await main.getByText(/excerpt/i).count()) > 0,
  )
  const stillDraft = (await api(`/content/articles/${articleId}`, { token })).body?.article
  ok('and the article is still a draft', stillDraft?.status === 'draft', stillDraft?.status)

  await page.getByRole('textbox', { name: /^Excerpt/ }).first().fill('A short line so this article can be published.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.waitForTimeout(2500)

  const published = (await api(`/content/articles/${articleId}`, { token })).body?.article
  ok('with an excerpt it publishes', published?.status === 'published', published?.status)

  // The whole point of publishing is that the shop can see it.
  const onShop = await fetch(`${API}/api/v1/content/journal/${published?.slug}`)
  ok('and the storefront can read it immediately', onShop.status === 200, String(onShop.status))

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  ok(
    'the screen now offers to unpublish rather than to publish',
    (await main.getByRole('button', { name: 'Unpublish' }).count()) === 1,
  )

  // ── the list reflects it ──────────────────────────────────────────────────
  await clickNav(page, 'Journal')
  await page.waitForURL('**/content/articles', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok(
    'the new article is in the list',
    (await main.locator(`[data-article-id="${articleId}"]`).count()) === 1,
  )

  // ── blogs ─────────────────────────────────────────────────────────────────
  // A shop starts with one blog and most never add a second, so the Journal's
  // column and filter stay hidden until there is something to choose between.
  // That is the behaviour worth pinning: the Journal has to change shape when a
  // second blog appears, and change back when it goes.
  console.log('\nBlogs')

  const blogsBefore = (await api('/content/blogs', { token })).body?.blogs ?? []
  const defaultBlog = blogsBefore[0]
  ok('the shop has at least one blog to start with', Boolean(defaultBlog), JSON.stringify(blogsBefore.map((b) => b.slug)))

  ok(
    'with a single blog the journal does not ask which one',
    blogsBefore.length > 1 || (await main.getByRole('combobox', { name: 'Blog' }).count()) === 0,
  )

  // The Journal's button is a way into the screen, not a dialog of its own —
  // there is one place blogs are managed, and this is how someone gets there
  // from the article they were looking at.
  await main.getByRole('button', { name: /Manage blogs/i }).click()
  await page.waitForURL('**/content/blogs', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('the blogs screen opens from the journal', page.url().endsWith('/content/blogs'))
  ok(
    'and lists the blogs that exist',
    (await main.locator('[data-blog-id]').count()) === blogsBefore.length,
    `${await main.locator('[data-blog-id]').count()} rows vs ${blogsBefore.length} from the API`,
  )
  ok(
    'each row shows the address the blog will have on the site',
    (await main.getByText(`/blog/${defaultBlog?.slug}`).count()) >= 1,
  )

  const BLOG_TITLE = `Smoke blog ${stamp}`
  await main.getByRole('textbox', { name: /^Title/ }).fill(BLOG_TITLE)
  await main.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(2000)

  let blogsNow = (await api('/content/blogs', { token })).body?.blogs ?? []
  const created = blogsNow.find((blog) => blog.title === BLOG_TITLE)
  ok('adding a blog creates it', Boolean(created), JSON.stringify(blogsNow.map((b) => b.title)))
  ok('and the handle is made from the title', created?.slug === `smoke-blog-${stamp.toLowerCase()}`, created?.slug)
  ok('it starts empty', Number(created?.article_count) === 0, String(created?.article_count))
  ok(
    'and the screen shows it without a reload',
    (await main.locator(`[data-blog-id="${created?.id}"]`).count()) === 1,
  )

  // Renaming leaves the handle alone: the address of a published blog is not
  // something a rename should quietly break.
  await main.getByRole('button', { name: `Rename ${BLOG_TITLE}` }).click()
  await page.waitForTimeout(500)
  const renameField = main.locator(`[data-blog-id="${created?.id}"]`).getByRole('textbox')
  await renameField.fill(`${BLOG_TITLE} renamed`)
  await main.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(2000)

  blogsNow = (await api('/content/blogs', { token })).body?.blogs ?? []
  const renamed = blogsNow.find((blog) => blog.id === created?.id)
  ok('renaming a blog saves the new title', renamed?.title === `${BLOG_TITLE} renamed`, renamed?.title)
  ok('and leaves its handle untouched', renamed?.slug === created?.slug, renamed?.slug)

  await clickNav(page, 'Journal')
  await page.waitForURL('**/content/articles', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok(
    'with a second blog the journal grows a Blog filter',
    (await main.getByRole('combobox', { name: 'Blog' }).count()) === 1,
  )
  ok('and a Blog column', (await main.getByRole('columnheader', { name: 'Blog' }).count()) === 1)

  // ── an article can be moved between blogs ─────────────────────────────────
  await page.goto(`${BASE}/content/articles/${articleId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  ok(
    'the article form offers the blog it belongs to',
    (await page.getByRole('combobox', { name: 'Blog' }).count()) === 1,
  )
  await page.getByRole('combobox', { name: 'Blog' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('option', { name: `${BLOG_TITLE} renamed` }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(2500)

  const moved = (await api(`/content/articles/${articleId}`, { token })).body?.article
  ok('moving the article to the other blog saves', Number(moved?.blog_id ?? moved?.blog?.id) === created?.id, JSON.stringify(moved?.blog))

  const afterMove = (await api('/content/blogs', { token })).body?.blogs ?? []
  ok(
    'and the counts follow it',
    Number(afterMove.find((b) => b.id === created?.id)?.article_count) === 1,
    JSON.stringify(afterMove.map((b) => [b.title, b.article_count])),
  )

  // Published work is public, so the move has to reach the storefront too.
  const onItsBlog = await fetch(`${API}/api/v1/content/journal?blog=${created?.slug}`)
  const onItsBlogBody = await onItsBlog.json().catch(() => ({}))
  ok(
    'the storefront lists it under the new blog',
    (onItsBlogBody.articles ?? []).some((item) => item.slug === published?.slug),
    JSON.stringify((onItsBlogBody.articles ?? []).map((a) => a.slug)),
  )

  // ── the count is the way into the articles it holds ───────────────────────
  await clickNav(page, 'Blogs')
  await page.waitForURL('**/content/blogs', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok('Blogs is reachable from the sidebar in its own right', page.url().endsWith('/content/blogs'))
  ok(
    'the moved article is counted against its new blog',
    (await main.locator(`[data-blog-id="${created?.id}"]`).getByRole('button', { name: '1' }).count()) === 1,
  )
  await main.locator(`[data-blog-id="${created?.id}"]`).getByRole('button', { name: '1' }).click()
  await page.waitForURL(`**/content/articles?blog_id=${created?.id}`, { timeout: 15000 })
  await page.waitForTimeout(2500)
  ok(
    'and clicking the count opens the journal filtered to that blog',
    (await main.locator(`[data-article-id="${articleId}"]`).count()) === 1 &&
      (await main.locator('[data-article-id]').count()) === 1,
    `${await main.locator('[data-article-id]').count()} rows`,
  )

  // ── deleting a blog moves its articles rather than taking them ────────────
  await clickNav(page, 'Blogs')
  await page.waitForURL('**/content/blogs', { timeout: 15000 })
  await page.waitForTimeout(2000)

  await main.getByRole('button', { name: `Delete ${BLOG_TITLE} renamed` }).click()
  await page.waitForTimeout(600)
  ok(
    'deleting a blog with articles in it asks where they should go',
    (await main.getByRole('combobox', { name: /Move articles to/i }).count()) === 1,
  )
  ok(
    'and will not go through until somewhere is chosen',
    await main.getByRole('button', { name: /Move and delete/i }).isDisabled(),
  )

  await main.getByRole('combobox', { name: /Move articles to/i }).click()
  await page.waitForTimeout(500)
  await page.getByRole('option', { name: defaultBlog?.title }).click()
  await page.waitForTimeout(400)
  await main.getByRole('button', { name: /Move and delete/i }).click()
  await page.waitForTimeout(2500)

  const afterDelete = (await api('/content/blogs', { token })).body?.blogs ?? []
  ok('the blog is gone', !afterDelete.some((blog) => blog.id === created?.id), JSON.stringify(afterDelete.map((b) => b.title)))

  const survivor = (await api(`/content/articles/${articleId}`, { token })).body?.article
  ok(
    'and its article survived, in the blog that was chosen',
    Number(survivor?.blog_id ?? survivor?.blog?.id) === defaultBlog?.id,
    JSON.stringify(survivor?.blog),
  )
  ok('with nothing else about it changed', survivor?.status === 'published', survivor?.status)

  ok(
    'the last blog cannot be deleted, and the button says so by being off',
    afterDelete.length > 1 ||
      (await main.getByRole('button', { name: new RegExp(`^Delete ${defaultBlog?.title}$`) }).isDisabled()),
  )

  await clickNav(page, 'Journal')
  await page.waitForURL('**/content/articles', { timeout: 15000 })
  await page.waitForTimeout(2000)
  ok(
    'and the Blog filter disappears again once there is only one',
    afterDelete.length > 1 || (await main.getByRole('combobox', { name: 'Blog' }).count()) === 0,
  )

  // ── tidy up ───────────────────────────────────────────────────────────────
  // Asserted, not hoped for. A run that leaves a published article behind moves
  // the next run's baseline, and this suite has already done that once.
  console.log('\nTidy up')
  await api(`/content/articles/${articleId}/archive`, { method: 'POST', token })
  const removed = await api(`/content/articles/${articleId}`, { method: 'DELETE', token })
  ok('the suite deletes the article it wrote', removed.status === 200, String(removed.status))

  // If an assertion above failed before the delete ran, the blog is still
  // there, and the next run would start from two blogs rather than one.
  if (created?.id) {
    await api(`/content/blogs/${created.id}?reassign_to=${defaultBlog?.id}`, { method: 'DELETE', token })
  }
  const blogsAfter = (await api('/content/blogs', { token })).body?.blogs ?? []
  ok(
    'and leaves the blogs exactly as it found them',
    blogsAfter.length === blogsBefore.length,
    JSON.stringify(blogsAfter.map((b) => b.title)),
  )

  console.log('\nConsole')
  // The 409 and the 422 are this suite's own doing: it publishes an article with
  // no excerpt, and submits `javascript:alert(1)` as an Instagram address, both
  // to prove the API refuses them. The browser logs every failed fetch.
  // Filtering these two is honest; asserting zero errors would mean deleting
  // the assertions that matter.
  const unexpected = consoleErrors.filter(
    (text) => !/favicon|ERR_|404|status of 409|status of 422/i.test(text),
  )
  ok('no console errors across the whole journey', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n${'─'.repeat(60)}\n  ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log(`  failures: ${failures.join(', ')}`)
    process.exit(1)
  }
}

run().catch((error) => {
  console.error(`\nFATAL: ${error.message}`)
  process.exit(1)
})
