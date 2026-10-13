/**
 * The Google Fonts a theme's font_picker offers, with the weights each has —
 * the same list as the backend's (src/platform/themes/fonts.ts), so the
 * editor previews exactly the families the storefront can load.
 */
export const FONT_FAMILIES: Record<string, number[]> = {
  Inter: [400, 500, 600, 700],
  'DM Sans': [400, 500, 600, 700],
  Manrope: [400, 500, 600, 700],
  'Work Sans': [400, 500, 600, 700],
  'IBM Plex Sans': [400, 500, 600, 700],
  Poppins: [400, 500, 600, 700],
  'Nunito Sans': [400, 600, 700],
  Karla: [400, 500, 600, 700],
  'Space Grotesk': [400, 500, 600, 700],
  Outfit: [400, 500, 600, 700],
  Archivo: [400, 500, 600, 700, 800],
  Syne: [400, 500, 600, 700],
  'Playfair Display': [400, 500, 600, 700],
  'Cormorant Garamond': [400, 500, 600, 700],
  'Libre Baskerville': [400, 700],
  Lora: [400, 500, 600, 700],
  Fraunces: [400, 500, 600, 700],
  'EB Garamond': [400, 500, 600, 700],
  'DM Serif Display': [400],
  'Bebas Neue': [400],
}

/** One stylesheet URL for the families, each asked only for weights it has. */
export function googleFontsHref(families: string[]): string | null {
  const unique = [...new Set(families.filter(Boolean))]
  if (!unique.length) return null
  const query = unique.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${(FONT_FAMILIES[family] ?? [400, 700]).join(';')}`).join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
