import { useAuth } from '../../auth/useAuth'

/**
 * The platform role of whoever is signed in. Support staff can look at every
 * store; only platform admins can change anything — the API enforces this,
 * the console just does not offer what would be refused.
 */
export function useOperator() {
  const { admin } = useAuth()
  const role = admin?.platform_role ?? 'none'
  return { role, isOperator: role === 'admin' || role === 'support', canAct: role === 'admin' }
}
