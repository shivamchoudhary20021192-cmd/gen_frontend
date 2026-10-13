import type { Media } from '../api/types'

/**
 * Picks the smallest rendition that still covers the rendered size, and builds
 * a srcset from the rest. The API returns every variant it generated, so the
 * browser is never asked for a URL that does not exist — if variants are still
 * processing we fall back to the original rather than shipping a 404.
 */
export function thumbUrl(
  media: Pick<Media, 'url' | 'variants'> & { media_type?: Media['media_type'] },
  preferred = 'sm',
): string {
  const variants = media.variants ?? []
  // A video's variants are stills pulled out of it, so the ladder below works
  // unchanged. With no variants there is nothing picture-shaped to fall back
  // to — returning `url` would hand an <img> an .mp4 and draw a broken icon.
  if (variants.length === 0) return media.media_type === 'video' ? '' : media.url

  const order = ['thumb', 'sm', 'md', 'lg', 'xl']
  const startAt = Math.max(0, order.indexOf(preferred))

  // Up from the preferred size first, then back down. The downward half is not
  // decoration: variants are never upscaled, so a 320px-wide source only ever
  // gets a `thumb`, and a walk that only goes upward finds nothing at all for
  // it. For an image that merely fell back to the original; for a video there
  // is no image to fall back to, and the tile drew a file icon instead of the
  // still that was sitting right there.
  const candidates = [...order.slice(startAt), ...order.slice(0, startAt).reverse()]

  for (const key of candidates) {
    // webp before avif: wider decoder support, and the size difference is small
    // at thumbnail dimensions.
    const webp = variants.find((v) => v.key === key && v.format === 'webp')
    if (webp) return webp.url
    const any = variants.find((v) => v.key === key)
    if (any) return any.url
  }
  return media.media_type === 'video' ? '' : media.url
}

/** True when there is a still to show — an image, or a video with a poster. */
export function hasPicture(media: Pick<Media, 'url' | 'variants' | 'media_type'>): boolean {
  return media.media_type !== 'video' ? media.media_type === 'image' : thumbUrl(media) !== ''
}

/** "0:08", for a duration badge. Null durations render as nothing. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function srcSetFor(media: Pick<Media, 'variants'>, format = 'webp'): string | undefined {
  const variants = (media.variants ?? []).filter((v) => v.format === format && v.width > 0)
  if (variants.length === 0) return undefined
  return variants
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ')
}

/**
 * Focal point → CSS object-position. This is what stops a 4:5 mobile crop from
 * decapitating the bottle when the product sits off-centre in the frame.
 */
export function objectPosition(focal: { x: number; y: number } | undefined): string {
  if (!focal) return '50% 50%'
  return `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%`
}
