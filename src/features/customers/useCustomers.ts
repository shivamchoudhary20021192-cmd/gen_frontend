import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Pagination } from '../../api/types'

export type CustomerStatus = 'active' | 'blocked' | 'deleted'

export interface CustomerSummary {
  id: number
  public_id: string
  name: string
  first_name: string | null
  last_name: string | null
  country_code: string
  /**
   * Masked on the list, full on the detail — the server decides, not the UI.
   * Browsing a customer table should not put ten thousand phone numbers on a
   * screen someone might be sharing.
   */
  phone: string
  email: string | null
  gender: string | null
  date_of_birth: string | null
  status: CustomerStatus
  phone_verified: boolean
  email_verified: boolean
  marketing: { email: boolean; sms: boolean; whatsapp: boolean }
  skin_type_id: number | null
  primary_concern_id: number | null
  stats: {
    orders_count: number
    total_spent: number
    average_order_value: number
    last_order_at: string | null
    rto_count: number
  }
  cod_blocked: boolean
  signup_source: string | null
  created_at?: string
}

export interface CustomerAddress {
  id: number
  label: string | null
  address_type: string
  name: string
  phone: string | null
  line1: string
  line2: string | null
  landmark: string | null
  city: string
  state: string
  state_code: string | null
  pincode: string
  country: string | null
  is_default_shipping: boolean
  is_default_billing: boolean
  is_verified: boolean
  delivery_notes: string | null
}

export interface CustomerNote {
  id: number
  note: string
  is_pinned: boolean
  author: string
  created_at: string
}

export interface CustomerConsent {
  purpose: string
  status: string
  source: string | null
  notice_version: string | null
  recorded_at: string
}

export interface CustomerDetail extends CustomerSummary {
  addresses: CustomerAddress[]
  notes: CustomerNote[]
  consents: CustomerConsent[]
}

export interface CustomerListParams {
  // Indexed because these go straight to the query-string builder, which
  // enumerates them without knowing the exact shape.
  [key: string]: string | number | boolean | undefined
  page?: number
  limit?: number
  q?: string
  status?: string
  cod_blocked?: boolean
  marketing?: 'email' | 'sms' | 'whatsapp'
  has_orders?: boolean
  sort?: string
}

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: CustomerListParams) => ['customers', 'list', params] as const,
  detail: (id: number) => ['customers', 'detail', id] as const,
}

export function useCustomerList(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => api.get<{ customers: CustomerSummary[]; pagination: Pagination }>('/customers', params),
    placeholderData: (previous) => previous,
  })
}

export function useCustomer(id: number | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? 0),
    queryFn: () => api.get<{ customer: CustomerDetail }>(`/customers/${id}`),
    enabled: Boolean(id),
  })
}

function useCustomerMutation<TVariables>(
  id: number,
  run: (variables: TVariables) => Promise<{ customer: CustomerDetail }>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (data) => {
      queryClient.setQueryData(customerKeys.detail(id), data)
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
    },
  })
}

export interface CustomerUpdate {
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  gender?: 'female' | 'male' | 'other' | 'undisclosed' | null
  date_of_birth?: string | null
  accepts_email_marketing?: boolean
  accepts_sms_marketing?: boolean
  accepts_whatsapp_marketing?: boolean
  cod_blocked?: boolean
}

export function useUpdateCustomer(id: number) {
  return useCustomerMutation<CustomerUpdate>(id, (customer) =>
    api.patch<{ customer: CustomerDetail }>(`/customers/${id}`, { customer }),
  )
}

/**
 * Blocking is a POST rather than a PATCH on `status` because it revokes the
 * customer's sessions as a side effect — that belongs in the audit trail as its
 * own action, not as a field edit.
 */
export function useBlockCustomer(id: number) {
  return useCustomerMutation<{ reason?: string | null }>(id, (body) =>
    api.post<{ customer: CustomerDetail }>(`/customers/${id}/block`, body),
  )
}

export function useUnblockCustomer(id: number) {
  return useCustomerMutation<void>(id, () =>
    api.post<{ customer: CustomerDetail }>(`/customers/${id}/unblock`, {}),
  )
}

export function useAddCustomerNote(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { note: string; is_pinned?: boolean }) =>
      api.post<{ note: CustomerNote }>(`/customers/${id}/notes`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
    },
  })
}

export function useDeleteCustomerNote(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (noteId: number) => api.delete<unknown>(`/customers/${id}/notes/${noteId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
    },
  })
}
