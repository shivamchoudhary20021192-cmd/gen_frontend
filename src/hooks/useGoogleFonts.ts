import { useEffect } from 'react'
import { googleFontsHref } from '../lib/googleFonts'

/**
 * Loads Google Fonts families for previews (theme editor, theme cards);
 * removed on unmount. Each family is asked only for weights it has — Google
 * refuses the whole stylesheet if one family is asked for a weight it lacks.
 */
export function useGoogleFonts(families: string[]) {
  const key = families.filter(Boolean).join('|')
  useEffect(() => {
    const href = key ? googleFontsHref(key.split('|')) : null
    if (!href) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
    return () => link.remove()
  }, [key])
}
