/**
 * Finds a product the storefront will actually sell.
 *
 * Every suite used to take the first featured product and its first variant.
 * That works once: the suites then buy through the stock, and a few runs later
 * the top of the featured list is out of stock. Adding an unavailable variant
 * fails at the cart, so the symptom arrived several calls later as a 409 about
 * an empty bag — with nothing pointing at the real cause.
 *
 * @param {string} api        origin of the storefront API
 * @param {number} [quantity] how many units the caller intends to buy
 */
export async function pickSellable(api, quantity = 1) {
  const response = await fetch(`${api}/api/v1/products?limit=48&sort=featured`)
  const listed = await response.json()
  const products = listed.products ?? []

  if (products.length === 0) {
    throw new Error(
      `the storefront listed no products (${response.status} ${JSON.stringify(listed).slice(0, 160)})`,
    )
  }

  // The storefront deliberately does not publish stock counts — `in_stock` is a
  // boolean and `inventory_quantity` comes back null — so the only honest way
  // to know whether it will sell N of something is to ask it for N. One scratch
  // cart is reused for every attempt and never checked out; a refusal is the
  // answer, not an error.
  const scratch = await (await fetch(`${api}/api/v1/cart`, { method: 'POST' })).json()
  const token = scratch.cart?.token
  const refusals = []

  for (const candidate of products) {
    const detail = await (await fetch(`${api}/api/v1/products/${candidate.slug}`)).json()
    for (const variant of (detail.product?.variants ?? []).filter((v) => v.in_stock)) {
      if (!token) return { slug: candidate.slug, product: detail.product, variant }

      const attempt = await fetch(`${api}/api/v1/cart/${token}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variant.id, quantity }),
      })
      if (attempt.ok) return { slug: candidate.slug, product: detail.product, variant }

      const why = await attempt.json().catch(() => ({}))
      refusals.push(`${candidate.slug}: ${why.error?.message ?? attempt.status}`)
    }
  }

  throw new Error(
    `no product in the catalogue will sell ${quantity} units — ` +
      `restock one before running this suite. Refusals: ${refusals.slice(0, 3).join(' | ')}`,
  )
}
