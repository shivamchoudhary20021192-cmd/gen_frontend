import { api } from './client'

export interface Segment {
  id: number
  name: string
  description: string | null
  segment_type: 'manual' | 'auto' | 'imported'
  rules: any | null
  rules_operator: 'all' | 'any'
  customer_count: number
  last_calculated_at: string | null
  color: string | null
  icon: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface SegmentMember {
  id: number
  customer_id: number
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string
  country_code: string
  total_spent: number
  orders_count: number
  last_order_at: string | null
  added_at: string
}

export interface CustomerTag {
  id: number
  name: string
  color: string | null
  description?: string | null
  usage_count?: number
}

export const segmentsApi = {
  // Segments
  list: (params?: { segment_type?: string; search?: string }) =>
    api.get<{ segments: Segment[] }>('/segments', params),

  get: (id: number) =>
    api.get<{ segment: Segment }>(`/segments/${id}`),

  create: (data: {
    name: string
    description?: string
    segment_type: 'manual' | 'auto' | 'imported'
    rules?: any
    rules_operator?: 'all' | 'any'
    color?: string
    icon?: string
  }) => api.post<{ id: number }>('/segments', data),

  update: (
    id: number,
    data: {
      name?: string
      description?: string
      rules?: any
      rules_operator?: 'all' | 'any'
      color?: string
      icon?: string
    }
  ) => api.patch(`/segments/${id}`, data),

  delete: (id: number) => api.delete(`/segments/${id}`),

  // Segment members
  getMembers: (id: number, params?: { page?: number; limit?: number }) =>
    api.get<{
      data: SegmentMember[]
      pagination: {
        page: number
        limit: number
        total: number
        pages: number
      }
    }>(`/segments/${id}/members`, params),

  addMember: (id: number, customerId: number) =>
    api.post(`/segments/${id}/members`, { customer_id: customerId }),

  removeMember: (id: number, customerId: number) =>
    api.delete(`/segments/${id}/members/${customerId}`),

  // Tags
  listTags: () => api.get<{ tags: CustomerTag[] }>('/tags'),

  createTag: (data: { name: string; color?: string; description?: string }) =>
    api.post<{ id: number }>('/tags', data),

  updateTag: (
    id: number,
    data: { name?: string; color?: string; description?: string }
  ) => api.patch(`/tags/${id}`, data),

  deleteTag: (id: number) => api.delete(`/tags/${id}`),

  getCustomerTags: (customerId: number) =>
    api.get<{ tags: CustomerTag[] }>(`/customers/${customerId}/tags`),

  assignTag: (tagId: number, customerId: number) =>
    api.post('/tags/assign', { tag_id: tagId, customer_id: customerId }),

  removeTag: (tagId: number, customerId: number) =>
    api.post('/tags/remove', { tag_id: tagId, customer_id: customerId }),
}
