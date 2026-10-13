/**
 * Which menu keys this build can actually render.
 *
 * The database decides what appears in the sidebar; this file decides what is
 * clickable. A row flipped to 'available' by someone editing the menu, but
 * pointing at a screen that does not exist in the deployed bundle, degrades to
 * a disabled item instead of a route that 404s.
 *
 * Add the key here on the same commit that adds the page — that pairing is the
 * whole safety mechanism.
 */
export const IMPLEMENTED_ROUTE_KEYS = new Set<string>([
  'dashboard',
  'orders',
  'orders.all',
  'orders.abandoned',
  'orders.returns',
  'orders.shipments',
  'orders.invoices',
  'customers',
  'customers.all',
  'customers.segments',
  'customers.reengagement',
  'customers.subscribers',
  'customers.privacy',
  'customers.messages',
  'products',
  'products.all',
  'products.categories',
  'products.collections',
  'products.inventory',
  'products.reviews',
  'products.gift_cards',
  'catalog',
  'catalog.products',
  'catalog.custom_data',
  'catalog.metaobjects',
  'media',
  'discounts',
  'content',
  'content.pages',
  'content.articles',
  'content.blogs',
  'content.comments',
  'content.creators',
  'content.sections',
  'content.banners',
  'content.announcements',
  'content.faqs',
  'content.menus',
  // 'content.redirects' is deliberately absent: the screens behind it are still
  // placeholders, so the row stays greyed out rather than routing to an empty
  // page. Add it back on the commit that builds them.
  'notifications',
  'notifications.templates',
  'notifications.campaigns',
  'notifications.activity',
  'notifications.senders',
  'merchandising',
  'merchandising.pages',
  'merchandising.shelves',
  'merchandising.themes',
  'settings',
  'settings.store',
  'settings.billing',
  'settings.markets',
  'settings.taxes',
  'settings.domains',
  'settings.integrations',
  'settings.notifications',
  'settings.apps',
  'settings.shipping',
  'settings.payments',
  'settings.staff',
  'settings.roles',
  'settings.navigation',
  'settings.customer_accounts',
  'settings.customer_privacy',
  'settings.policies',
  'settings.languages',
  'settings.audit',
])

export function isImplemented(key: string): boolean {
  return IMPLEMENTED_ROUTE_KEYS.has(key)
}
