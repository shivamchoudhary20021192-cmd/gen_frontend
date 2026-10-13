import type { Announcement, AnnouncementInput } from './useAnnouncements'

/** The line dialog's form: from a line, and back to the API's payload. */

const EMPTY: AnnouncementInput = {
  message: '',
  kind: 'message',
  success_message: '',
  free_shipping_threshold: null,
  coupon_id: null,
  link_type: 'none',
  link_url: '',
  link_ref_id: null,
  cta_label: '',
  starts_at: null,
  ends_at: null,
  show_countdown: false,
  background_hex: null,
  text_hex: null,
  visibility: 'all',
  show_on: [],
  audience: 'all',
  countries: [],
  is_active: true,
}

export function formFor(target: Announcement | 'new'): AnnouncementInput {
  if (target === 'new') return { ...EMPTY }
  return {
    message: target.message,
    kind: target.kind,
    success_message: target.success_message ?? '',
    free_shipping_threshold: target.free_shipping_threshold,
    coupon_id: target.coupon?.id ?? null,
    link_type: target.link.type,
    link_url: target.link.url ?? '',
    link_ref_id: target.link.ref_id,
    cta_label: target.link.label ?? '',
    starts_at: target.starts_at,
    ends_at: target.ends_at,
    show_countdown: target.show_countdown,
    background_hex: target.background_hex,
    text_hex: target.text_hex,
    visibility: target.visibility,
    show_on: target.show_on,
    audience: target.audience,
    countries: target.countries,
    is_active: target.is_active,
  }
}

/** The payload: empty strings become nulls, and fields that do not apply are cleared. */
export function payloadFor(form: AnnouncementInput): AnnouncementInput {
  const freeShipping = form.kind === 'free_shipping'
  return {
    ...form,
    success_message: freeShipping ? form.success_message?.trim() || null : null,
    free_shipping_threshold: freeShipping ? form.free_shipping_threshold ?? null : null,
    link_url: form.link_type === 'url' || form.link_type === 'policy' ? form.link_url || null : null,
    link_ref_id: form.link_type === 'url' || form.link_type === 'none' || form.link_type === 'policy' ? null : (form.link_ref_id ?? null),
    cta_label: form.link_type === 'none' ? null : form.cta_label?.trim() || null,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    show_countdown: Boolean(form.show_countdown && form.ends_at),
  }
}
