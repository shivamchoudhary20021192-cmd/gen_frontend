import type { LibraryTheme } from './themeTypes'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

/** A screenshot URL from the API, absolute when the admin is served apart from it. */
export function apiAsset(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('/') ? `${API_BASE}${url}` : url
}

/** A theme's screenshot for a style (or its first style's), desktop or phone. */
export function screenshotOf(theme: Pick<LibraryTheme, 'screenshots' | 'presets'> | null | undefined, style: string | null | undefined, device: 'desktop' | 'mobile' = 'desktop'): string | null {
  const shots = theme?.screenshots
  if (!shots) return null
  const entry = (style ? shots[style] : undefined) ?? shots[theme?.presets[0]?.key ?? ''] ?? Object.values(shots)[0]
  return apiAsset(entry?.[device] ?? null)
}
