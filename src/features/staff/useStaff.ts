import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { AdminUser, Pagination } from '../../api/types'

export type StaffStatus = 'invited' | 'active' | 'suspended' | 'disabled'

export interface Role {
  id: number
  slug: string
  name: string
  description: string | null
  is_system: boolean
  level: number
  permission_count: number
  admin_count: number
  permissions?: { id: number; slug: string; name: string; module: string }[]
}

export interface Permission {
  id: number
  slug: string
  action: string
  name: string
  description: string | null
  is_dangerous: boolean
}

export interface StaffInput {
  email?: string
  password?: string
  first_name?: string
  last_name?: string | null
  phone?: string | null
  job_title?: string | null
  timezone?: string
  role_ids?: number[]
  is_super_admin?: boolean
  must_change_password?: boolean
}

export interface RoleInput {
  slug?: string
  name?: string
  description?: string | null
  level?: number
  permission_ids?: number[]
}

export const staffKeys = {
  all: ['admin-users'] as const,
  list: (params: Record<string, unknown>) => ['admin-users', 'list', params] as const,
  detail: (id: number) => ['admin-users', 'detail', id] as const,
  permissions: (id: number) => ['admin-users', 'permissions', id] as const,
}

export const roleKeys = {
  all: ['roles'] as const,
  detail: (id: number) => ['roles', 'detail', id] as const,
  permissions: ['permissions'] as const,
}

// ── staff ────────────────────────────────────────────────────────────────────

export function useStaffList(params: Record<string, string | number | boolean | undefined> = {}) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: ({ signal }) =>
      api.get<{ admin_users: AdminUser[]; pagination: Pagination }>(
        '/admin-users',
        { limit: 50, ...params },
        signal,
      ),
    placeholderData: (previous) => previous,
  })
}

export function useStaffMember(id: number | undefined) {
  return useQuery({
    queryKey: staffKeys.detail(id ?? 0),
    queryFn: () => api.get<{ admin_user: AdminUser }>(`/admin-users/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

/**
 * The permissions this account actually resolves to.
 *
 * Roles are the input; this is the output, after direct grants and denies are
 * applied. Worth showing on the form, because "why can't they see Orders?" is
 * answered here and nowhere else.
 */
export function useStaffPermissions(id: number | undefined) {
  return useQuery({
    queryKey: staffKeys.permissions(id ?? 0),
    queryFn: () =>
      api.get<{ permissions: string[]; is_super_admin: boolean }>(`/admin-users/${id}/permissions`),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (admin_user: StaffInput) =>
      api.post<{ admin_user: AdminUser }>(
        '/admin-users',
        { admin_user },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
      // Role rows carry an admin_count that just changed.
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    },
  })
}

export function useUpdateStaff(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (admin_user: StaffInput) =>
      api.patch<{ admin_user: AdminUser }>(`/admin-users/${id}`, { admin_user }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}

/** Role assignment is its own endpoint — it replaces the whole set. */
export function useSetStaffRoles(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleIds: number[]) =>
      api.post<{ admin_user: AdminUser }>(`/admin-users/${id}/roles`, { role_ids: roleIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    },
  })
}

export function useStaffAction(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'suspend' | 'activate') =>
      api.post<{ admin_user: AdminUser }>(`/admin-users/${id}/${action}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}

export function useResetStaffPassword(id: number) {
  return useMutation({
    mutationFn: (input: { new_password: string; must_change_password: boolean; revoke_sessions: boolean }) =>
      api.post<{ message: string }>(`/admin-users/${id}/reset-password`, input),
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin-users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    },
  })
}

// ── roles ────────────────────────────────────────────────────────────────────

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: () => api.get<{ roles: Role[] }>('/roles'),
    staleTime: 60_000,
  })
}

export function useRole(id: number | undefined) {
  return useQuery({
    queryKey: roleKeys.detail(id ?? 0),
    queryFn: () => api.get<{ role: Role }>(`/roles/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

/** Every permission the system defines, grouped by module. */
export function usePermissions() {
  return useQuery({
    queryKey: roleKeys.permissions,
    queryFn: () =>
      api.get<{ permissions: Record<string, Permission[]>; total: number }>('/permissions'),
    staleTime: 10 * 60_000,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: RoleInput) =>
      api.post<{ role: Role }>('/roles', { role }, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    },
  })
}

export function useUpdateRole(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: RoleInput) => api.patch<{ role: Role }>(`/roles/${id}`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
      // Someone's effective permissions may have just changed.
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/roles/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    },
  })
}
