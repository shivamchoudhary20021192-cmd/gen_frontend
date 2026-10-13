import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

/**
 * Messaging — templates, senders, campaigns and the delivery log.
 *
 * Two things this file deliberately does not know:
 *
 *   - **which merge fields exist.** They come from `/messaging/catalogue`, so
 *     adding one is a backend change and the insert menu picks it up.
 *   - **which rules block a send.** Every template and every campaign carries
 *     its own `violations`, computed on the server against the same code that
 *     will refuse the send. The screens render what they are told rather than
 *     re-implementing DLT and WhatsApp policy in TypeScript, which is the only
 *     way the editor and the sender can agree.
 */

const PATH = '/messaging'

export type Channel = 'whatsapp' | 'sms' | 'email'
export type Category = 'marketing' | 'utility' | 'transactional' | 'authentication'

export interface Violation {
  code: string
  severity: 'blocker' | 'warning'
  message: string
  fix?: string
  field?: string
}

export interface SmsInfo {
  encoding: 'GSM-7' | 'UCS-2'
  characters: number
  billedUnits: number
  segments: number
  perSegment: number
  unsupportedCharacter: string | null
}

export interface MessageVariable {
  key: string
  label: string
  scope: string
  example: string
  help?: string
  availableInCampaigns: boolean
}

export interface AudienceField {
  key: string
  label: string
  type: string
  group: string
  options: { value: string; label: string }[] | null
  help: string | null
  operators: { value: string; label: string; needs_value: boolean }[]
}

export interface Catalogue {
  variables: MessageVariable[]
  audience: { fields: AudienceField[] }
  channels: { value: Channel; label: string }[]
  categories: { value: Category; label: string; help: string }[]
  rules: {
    promotional_window: string
    frequency_cap_hours: number
    dlt_enforced: boolean
    timezone: string
  }
}

export interface Template {
  id: number
  event_key: string
  channel: Channel
  category: Category
  locale: string
  name: string
  description: string | null
  subject: string | null
  preheader: string | null
  header_text: string | null
  body: string
  footer_text: string | null
  sender_id: number | null
  sender_name: string | null
  provider_template_id: string | null
  dlt_template_id: string | null
  approval_status: string | null
  approval_note: string | null
  sample_variables: Record<string, string> | null
  variables: string[]
  is_active: boolean
  last_used_at: string | null
  usage_count: number
  updated_at: string
  stats: { sent_30d: number; delivered_30d: number; failed_30d: number }
  violations: Violation[]
  can_send: boolean
  sms: SmsInfo | null
}

export interface TemplatePreview {
  channel: Channel
  subject: string | null
  header_text: string | null
  body: string
  footer_text: string | null
  sms: SmsInfo | null
  sender: { id: number; name: string; from: string; simulated: boolean } | null
  violations: Violation[]
}

export interface Sender {
  id: number
  channel: Channel
  name: string
  provider: string
  status: 'active' | 'paused'
  is_default: boolean
  from_email: string | null
  from_name: string | null
  reply_to: string | null
  sms_header: string | null
  dlt_pe_id: string | null
  dlt_entity_name: string | null
  waba_id: string | null
  phone_number_id: string | null
  display_phone: string | null
  daily_limit: number | null
  notes: string | null
  delivers: boolean
  stats: { sent_30d: number; failed_30d: number; templates_using: number }
}

export interface AudienceRule {
  field: string
  operator: string
  value?: unknown
}

export interface CampaignSummary {
  id: number
  name: string
  channel: Channel
  status: string
  template_name: string | null
  segment_name: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  sent_count: number
  delivered_count: number
  failed_count: number
  skipped_count: number
  cost: number
  created_by_name: string | null
  created_at: string
  last_error: string | null
}

export interface Campaign extends CampaignSummary {
  description: string | null
  template_id: number | null
  template_category: Category | null
  sender_id: number | null
  sender_name: string | null
  audience_type: 'segment' | 'rules' | 'manual' | 'all'
  segment_id: number | null
  rules: AudienceRule[]
  rules_operator: 'all' | 'any'
  customer_ids: number[]
  exclude_recent_hours: number | null
  timezone: string
  throttle_per_minute: number | null
  variables: Record<string, string>
  editable: boolean
  stats: {
    total_recipients: number
    sent: number
    delivered: number
    failed: number
    skipped: number
    pending: number
    cost: number
    delivery_rate: number | null
  }
}

export interface AudienceBreakdown {
  matched: number
  contactable: number
  eligible: number
  no_consent: number
  messaged_recently: number
}

export interface Preflight {
  campaign_id: number
  ready: boolean
  violations: Violation[]
  audience: AudienceBreakdown
  quiet_hours: { inside: boolean; message: string } | null
  sample: { id: number; name: string; recipient: string }[]
}

export interface LogMessage {
  id: number
  event_key: string
  channel: Channel
  recipient: string
  status: string
  customer_id: number | null
  customer_name: string | null
  campaign_id: number | null
  campaign_name: string | null
  template_name: string | null
  provider: string | null
  error_message: string | null
  cost: number
  queued_at: string
  delivered_at: string | null
  sent_by_name: string | null
  simulated: boolean
  body?: string | null
  subject?: string | null
}

export interface CustomerChannelState {
  channel: Channel
  address: string | null
  can_send: boolean
  reasons: string[]
  opted_in_to_marketing: boolean
  consent_status: string
  last_messaged_at: string | null
  free_text: boolean
  free_text_reason: string | null
  templates: { id: number; name: string; category: Category }[]
  limits: { body: number; subject: number }
}

export interface CustomerContext {
  customer: { id: number; name: string; email: string | null; phone: string | null; orders_count: number }
  channels: CustomerChannelState[]
  promotional_window: { inside: boolean; message: string }
  service_window_open: boolean
}

export const messagingKeys = {
  catalogue: ['messaging', 'catalogue'] as const,
  templates: (filters?: unknown) => ['messaging', 'templates', filters ?? {}] as const,
  template: (id: number) => ['messaging', 'template', id] as const,
  senders: ['messaging', 'senders'] as const,
  campaigns: (filters?: unknown) => ['messaging', 'campaigns', filters ?? {}] as const,
  campaign: (id: number) => ['messaging', 'campaign', id] as const,
  preflight: (id: number) => ['messaging', 'preflight', id] as const,
  recipients: (id: number, filters?: unknown) => ['messaging', 'recipients', id, filters ?? {}] as const,
  activity: (filters?: unknown) => ['messaging', 'activity', filters ?? {}] as const,
  summary: (days: number) => ['messaging', 'summary', days] as const,
  settings: ['messaging', 'settings'] as const,
  customer: (id: number) => ['messaging', 'customer', id] as const,
  thread: (id: number) => ['messaging', 'thread', id] as const,
}

/** The vocabulary. Changes only on deploy, so it is cached hard. */
export function useMessagingCatalogue() {
  return useQuery({
    queryKey: messagingKeys.catalogue,
    queryFn: () => api.get<Catalogue>(`${PATH}/catalogue`),
    staleTime: 10 * 60 * 1000,
  })
}

// ── templates ────────────────────────────────────────────────────────────────

export function useTemplates(filters: { channel?: string; category?: string; search?: string } = {}) {
  return useQuery({
    queryKey: messagingKeys.templates(filters),
    queryFn: () => api.get<{ templates: Template[] }>(`${PATH}/templates`, filters),
  })
}

export function useTemplate(id: number | null) {
  return useQuery({
    queryKey: messagingKeys.template(id ?? 0),
    queryFn: () => api.get<Template>(`${PATH}/templates/${id}`),
    enabled: id !== null,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return (prefix: string) => {
    void queryClient.invalidateQueries({ queryKey: ['messaging', prefix] })
  }
}

export function useSaveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: Record<string, unknown> }) =>
      id === null
        ? api.post<Template>(`${PATH}/templates`, input)
        : api.patch<Template>(`${PATH}/templates/${id}`, input),
    onSuccess: (template) => {
      queryClient.setQueryData(messagingKeys.template(template.id), template)
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'templates'] })
    },
  })
}

export function useDeleteTemplate() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.delete(`${PATH}/templates/${id}`),
    onSuccess: () => invalidate('templates'),
  })
}

export function useDuplicateTemplate() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Template>(`${PATH}/templates/${id}/duplicate`, {}),
    onSuccess: () => invalidate('templates'),
  })
}

/**
 * The preview.
 *
 * A mutation rather than a query on purpose: it is asked for after a save, with
 * whatever sample values the editor currently has, and caching it by template id
 * would show yesterday's words.
 */
export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ id, variables }: { id: number; variables?: Record<string, string> }) =>
      api.post<TemplatePreview>(`${PATH}/templates/${id}/preview`, { variables }),
  })
}

export function useTestSend() {
  return useMutation({
    mutationFn: ({ id, to, variables }: { id: number; to: string; variables?: Record<string, string> }) =>
      api.post<{ sent: boolean; status: string; simulated: boolean; error: string | null }>(
        `${PATH}/templates/${id}/test-send`,
        { to, variables },
      ),
  })
}

// ── senders ──────────────────────────────────────────────────────────────────

export function useSenders(channel?: Channel) {
  return useQuery({
    queryKey: [...messagingKeys.senders, channel ?? 'all'],
    queryFn: () => api.get<{ senders: Sender[] }>(`${PATH}/senders`, channel ? { channel } : undefined),
  })
}

export function useSaveSender() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: Record<string, unknown> }) =>
      id === null ? api.post<Sender>(`${PATH}/senders`, input) : api.patch<Sender>(`${PATH}/senders/${id}`, input),
    onSuccess: () => invalidate('senders'),
  })
}

export function useDeleteSender() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.delete(`${PATH}/senders/${id}`),
    onSuccess: () => invalidate('senders'),
  })
}

export function useMakeDefaultSender() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post(`${PATH}/senders/${id}/default`, {}),
    onSuccess: () => invalidate('senders'),
  })
}

// ── settings ─────────────────────────────────────────────────────────────────

export interface SettingRow {
  setting_key: string
  label: string | null
  value: string | null
  default_value: string | null
  value_type: string
  description: string | null
}

export function useMessagingSettings() {
  return useQuery({
    queryKey: messagingKeys.settings,
    queryFn: () => api.get<{ settings: SettingRow[] }>(`${PATH}/settings`),
  })
}

export function useSaveMessagingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Record<string, string>) => api.put(`${PATH}/settings`, { values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// ── campaigns ────────────────────────────────────────────────────────────────

export function useCampaigns(filters: { status?: string; channel?: string; search?: string } = {}) {
  return useQuery({
    queryKey: messagingKeys.campaigns(filters),
    queryFn: () => api.get<{ campaigns: CampaignSummary[] }>(`${PATH}/campaigns`, filters),
  })
}

/**
 * One campaign.
 *
 * Polled while it is sending, because the counters are the screen: a campaign
 * that moves only when you reload is a campaign you cannot tell from a stuck one.
 */
export function useCampaign(id: number | null) {
  return useQuery({
    queryKey: messagingKeys.campaign(id ?? 0),
    queryFn: () => api.get<Campaign>(`${PATH}/campaigns/${id}`),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? 3000 : false),
  })
}

export function useSaveCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: Record<string, unknown> }) =>
      id === null
        ? api.post<Campaign>(`${PATH}/campaigns`, input)
        : api.patch<Campaign>(`${PATH}/campaigns/${id}`, input),
    onSuccess: (campaign) => {
      queryClient.setQueryData(messagingKeys.campaign(campaign.id), campaign)
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'campaigns'] })
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'preflight', campaign.id] })
    },
  })
}

export function useDeleteCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.delete(`${PATH}/campaigns/${id}`),
    onSuccess: () => invalidate('campaigns'),
  })
}

export function useDuplicateCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Campaign>(`${PATH}/campaigns/${id}/duplicate`, {}),
    onSuccess: () => invalidate('campaigns'),
  })
}

export function usePreflight(id: number | null, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.preflight(id ?? 0),
    queryFn: () => api.get<Preflight>(`${PATH}/campaigns/${id}/preflight`),
    enabled: id !== null && enabled,
  })
}

/** A live count while the audience is being built, before anything is saved. */
export function useAudienceEstimate() {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<AudienceBreakdown>(`${PATH}/campaigns/estimate`, input),
  })
}

export function useCampaignAction(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) =>
      api.post<Campaign>(`${PATH}/campaigns/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

export function useCampaignRecipients(id: number, filters: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: messagingKeys.recipients(id, filters),
    queryFn: () =>
      api.get<{
        recipients: {
          id: number
          customer_id: number | null
          name: string
          recipient: string
          status: string
          skip_reason: string | null
          error_message: string | null
          log_id: number | null
          sent_at: string | null
        }[]
        pagination: { page: number; limit: number; total: number; pages: number }
      }>(`${PATH}/campaigns/${id}/recipients`, filters),
  })
}

// ── the outbox ───────────────────────────────────────────────────────────────

export function useActivity(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: messagingKeys.activity(filters),
    queryFn: () =>
      api.get<{
        messages: LogMessage[]
        pagination: { page: number; limit: number; total: number; pages: number }
      }>(`${PATH}/activity`, filters),
  })
}

export function useMessage(id: number | null) {
  return useQuery({
    queryKey: ['messaging', 'message', id],
    queryFn: () => api.get<LogMessage>(`${PATH}/activity/${id}`),
    enabled: id !== null,
  })
}

export function useActivitySummary(days = 30) {
  return useQuery({
    queryKey: messagingKeys.summary(days),
    queryFn: () =>
      api.get<{
        totals: { total: number; sent: number; delivered: number; failed: number; cost: number }
        by_channel: { channel: string; total: number; delivered: number; failed: number }[]
        daily: { day: string; total: number; failed: number }[]
      }>(`${PATH}/activity/summary`, { days }),
  })
}

// ── one customer ─────────────────────────────────────────────────────────────

export function useCustomerMessaging(customerId: number | null) {
  return useQuery({
    queryKey: messagingKeys.customer(customerId ?? 0),
    queryFn: () => api.get<CustomerContext>(`${PATH}/customers/${customerId}/context`),
    enabled: customerId !== null,
  })
}

export function useCustomerThread(customerId: number | null) {
  return useQuery({
    queryKey: messagingKeys.thread(customerId ?? 0),
    queryFn: () => api.get<{ messages: LogMessage[] }>(`${PATH}/customers/${customerId}/thread`),
    enabled: customerId !== null,
  })
}

export function useSendToCustomer(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<{ sent: boolean; log_id: number; delivered: boolean }>(
        `${PATH}/customers/${customerId}/send`,
        input,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messagingKeys.thread(customerId) })
      void queryClient.invalidateQueries({ queryKey: messagingKeys.customer(customerId) })
    },
  })
}

// ── shared presentation helpers ──────────────────────────────────────────────

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  push: 'Push',
}

export const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'info',
  paused: 'warning',
  completed: 'success',
  cancelled: 'default',
  failed: 'error',
  queued: 'default',
  sent: 'info',
  delivered: 'success',
  read: 'success',
  bounced: 'error',
  skipped: 'warning',
  pending: 'default',
}
