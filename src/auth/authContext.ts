import { createContext } from 'react'
import type { AdminUser } from '../api/types'

export interface AuthState {
  admin: AdminUser | null
  permissions: string[]
  isSuperAdmin: boolean
  status: 'loading' | 'authenticated' | 'anonymous'
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
  /** Super admin always returns true. */
  can(...permissions: string[]): boolean
}

export const AuthContext = createContext<AuthState | null>(null)
