import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onUnauthorized, tokenStore } from '../api/client'
import type { AdminUser, LoginResponse } from '../api/types'
import { AuthContext, type AuthState } from './authContext'

interface MeResponse {
  admin: AdminUser
  permissions: string[]
  is_super_admin: boolean
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  const clear = useCallback(() => {
    tokenStore.clear()
    setAdmin(null)
    setPermissions([])
    setIsSuperAdmin(false)
    setStatus('anonymous')
  }, [])

  // A dead session can surface from any query, not just this provider —
  // the API client shouts once and we tear the session down here.
  useEffect(() => onUnauthorized(clear), [clear])

  /**
   * On boot we hold a token from localStorage but no idea whether it is still
   * good — the account may have been suspended, or the role changed. /auth/me
   * is the cheapest way to find out, and it also refreshes permissions, which
   * deliberately do NOT live inside the JWT.
   */
  useEffect(() => {
    let cancelled = false

    if (!tokenStore.access) {
      setStatus('anonymous')
      return
    }

    api
      .get<MeResponse>('/auth/me')
      .then((data) => {
        if (cancelled) return
        setAdmin(data.admin)
        setPermissions(data.permissions)
        setIsSuperAdmin(data.is_super_admin)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) clear()
      })

    return () => {
      cancelled = true
    }
  }, [clear])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login<LoginResponse>({ email, password })
    tokenStore.set(result.access_token, result.refresh_token)
    setAdmin(result.admin)
    setPermissions(result.permissions)
    setIsSuperAdmin(result.admin.is_super_admin)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Server-side revocation is best effort; the local session goes either way.
    }
    clear()
  }, [clear])

  const can = useCallback(
    (...required: string[]) => {
      if (isSuperAdmin || permissions.includes('*')) return true
      return required.some((permission) => permissions.includes(permission))
    },
    [isSuperAdmin, permissions],
  )

  const value = useMemo<AuthState>(
    () => ({ admin, permissions, isSuperAdmin, status, login, logout, can }),
    [admin, permissions, isSuperAdmin, status, login, logout, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
