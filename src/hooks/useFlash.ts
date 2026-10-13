import { useCallback, useState } from 'react'

export interface Flash {
  text: string
  severity: 'success' | 'error' | 'info'
}

/** A transient message after a save or an action; pairs with FlashSnackbar. */
export function useFlash() {
  const [flash, setFlash] = useState<Flash | null>(null)
  const success = useCallback((text: string) => setFlash({ text, severity: 'success' }), [])
  const error = useCallback((text: string) => setFlash({ text, severity: 'error' }), [])
  const info = useCallback((text: string) => setFlash({ text, severity: 'info' }), [])
  const clear = useCallback(() => setFlash(null), [])
  return { flash, success, error, info, clear }
}
