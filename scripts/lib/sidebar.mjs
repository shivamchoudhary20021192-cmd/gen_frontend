/**
 * Sidebar navigation helpers for the UI smoke suites.
 *
 * The sidebar collapses every group it is not sitting inside, so a child row
 * such as Collections or Inventory simply does not exist in the DOM until its
 * parent is opened. Each suite used to click the child directly and time out
 * after thirty seconds with no hint as to why.
 */

/**
 * The sidebar specifically.
 *
 * `getByRole('navigation').first()` is not good enough: MUI's Pagination is
 * also a nav landmark, and on a list screen it comes first in the DOM — so the
 * helper would search a pager for a menu link and report that the sidebar was
 * empty. The layout labels the sidebar "Main" for exactly this reason.
 */
function navOf(page) {
  return page.getByRole('navigation', { name: 'Main' })
}

/**
 * Opens every collapsed group in the sidebar, one pass, newest first.
 * Returns how many it opened.
 */
export async function expandAllGroups(page) {
  const nav = navOf(page)
  let opened = 0

  // Routed groups (Products, Orders) carry their toggle on the chevron.
  const chevrons = nav.getByRole('button', { name: /^Expand / })
  for (let i = (await chevrons.count()) - 1; i >= 0; i -= 1) {
    const chevron = chevrons.nth(i)
    if (await chevron.isVisible().catch(() => false)) {
      await chevron.click()
      opened += 1
      await page.waitForTimeout(150)
    }
  }

  // Unrouted groups (Content, Settings) have no chevron button — the whole row
  // is the toggle. They announce their state through aria-expanded, which is
  // the only thing that distinguishes a shut group from an ordinary row.
  // :not([aria-disabled="true"]) matters: a group whose children are all
  // unbuilt renders disabled, and clicking it waits out the full timeout.
  const collapsed = nav.locator('[aria-expanded="false"]:not([aria-disabled="true"])')
  for (let i = (await collapsed.count()) - 1; i >= 0; i -= 1) {
    const group = collapsed.nth(i)
    if (await group.isVisible().catch(() => false)) {
      await group.click()
      opened += 1
      await page.waitForTimeout(200)
    }
  }

  return opened
}

/**
 * Clicks a sidebar link by name, opening whichever group hides it.
 *
 * @param {import('playwright').Page} page
 * @param {string|RegExp} name  the link's accessible name
 */
export async function clickNav(page, name) {
  const nav = navOf(page)
  const link = nav.getByRole('link', { name }).first()

  if (!(await link.isVisible().catch(() => false))) {
    await expandAllGroups(page)
  }

  if (!(await link.isVisible().catch(() => false))) {
    const available = await nav.getByRole('link').allInnerTexts()
    throw new Error(
      `sidebar has no link matching ${name} even with every group open.\n` +
        `  visible links: ${available.map((t) => t.replace(/\n+/g, ' ')).join(' | ')}`,
    )
  }

  await link.click()
  return link
}
