import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

/**
 * Story sections — the claims strip, the packaging diagram, a model's routine.
 *
 * A section is authored once in a library and attached wherever it belongs.
 * "Less harm, more pearl" is the same words on every product in a range, and
 * the alternative is correcting it in eleven places out of twelve.
 */

export interface Hotspot {
  id: number
  /** Percentages of the image, not pixels — see the editor for why. */
  x: number
  y: number
  label: string
  body: string | null
  line_direction: 'left' | 'right' | 'up' | 'down'
  image: string | null
  product: { slug: string; name: string } | null
}

export interface SectionBlock {
  id: number
  block_type: string
  sort_order: number
  is_enabled: boolean
  heading: string | null
  body: string | null
  media: string | null
  media_alt: string | null
  media_type: 'image' | 'video' | null
  poster: string | null
  secondary_media: string | null
  /** Whether this use carries the model's name and link. */
  credit_creator?: boolean
  /** Whether the person may be named on the site at all. */
  creator_identity_public?: boolean
  creator: {
    id: number
    name: string | null
    handle: string | null
    role: string | null
    portrait: string | null
    instagram_url: string | null
  } | null
  claim: { id: number; text: string | null; footnote: string | null; status: string | null } | null
  shade: { id: number; name: string | null; descriptor: string | null; hex: string | null } | null
  link: { type: string; ref_id: number | null; url: string | null; label: string | null }
  settings: Record<string, unknown> | null
  hotspots: Hotspot[]
}

export interface Section {
  id: number
  section_key: string
  name: string
  heading: string | null
  standfirst: string | null
  footnote: string | null
  layout: string
  background: string | null
  padding: { top: string; bottom: string }
  settings: Record<string, unknown> | null
  usage_count: number
  created_at: string
  updated_at: string
  blocks: SectionBlock[]
}

export interface SectionSummary {
  id: number
  section_key: string
  name: string
  heading: string | null
  layout: string
  usage_count: number
  block_count: number
  updated_at: string
}

/** A section as it sits on one product: the section, plus where it sits. */
export interface AttachedSection extends Section {
  assignment_id: number
  sort_order: number
  is_enabled: boolean
  visible_from: string | null
  visible_until: string | null
}

export interface SectionInput {
  section_key: string
  name: string
  heading?: string | null
  standfirst?: string | null
  footnote?: string | null
  layout?: 'split' | 'stacked' | 'carousel' | 'grid'
  background?: string | null
}

export interface BlockInput {
  block_type: string
  heading?: string | null
  body?: string | null
  media_id?: number | null
  secondary_media_id?: number | null
  creator_id?: number | null
  credit_creator?: boolean
  claim_id?: number | null
  option_value_id?: number | null
  link_type?: string
  link_url?: string | null
  cta_label?: string | null
  is_enabled?: boolean
}

export interface HotspotInput {
  x_pct: number
  y_pct: number
  label: string
  body?: string | null
  product_id?: number | null
  line_direction?: 'left' | 'right' | 'up' | 'down'
}

/** The kinds a section can be, and what each is for. */
export const SECTION_KINDS = [
  { key: 'claims', label: 'Claims', hint: 'Percentages from a study, with the footnote' },
  { key: 'packaging', label: 'Packaging', hint: 'A diagram with parts labelled' },
  { key: 'model_routine', label: "Model's routine", hint: 'Looks, with callouts on the photo' },
  { key: 'feature', label: 'Feature', hint: 'Image, title and copy' },
  { key: 'how_to', label: 'How to use', hint: 'Numbered steps' },
] as const

export const BLOCK_KINDS = [
  { key: 'stat', label: 'Stat', hint: '100% — said it gave cheeks a natural glow' },
  { key: 'look', label: 'Look', hint: 'A photo or film, with callouts pinned on it' },
  { key: 'diagram', label: 'Diagram', hint: 'An image with parts labelled' },
  { key: 'feature', label: 'Feature', hint: 'Image, heading and copy' },
  { key: 'step', label: 'Step', hint: 'One instruction' },
] as const

const PATH = '/content/sections'

export const sectionKeys = {
  all: ['sections'] as const,
  list: (search: string) => ['sections', 'list', search] as const,
  one: (id: number) => ['sections', id] as const,
  forProduct: (productId: number) => ['sections', 'product', productId] as const,
}

export function useSectionLibrary(search = '') {
  return useQuery({
    queryKey: sectionKeys.list(search),
    queryFn: () => api.get<{ sections: SectionSummary[] }>(PATH, search ? { q: search } : undefined),
    // Deliberately no staleTime, and a refetch whenever the tab regains focus.
    //
    // The product form links out to the library in a new tab. Someone writes a
    // section there, comes back, opens the picker — and with a cached list it
    // is not offered, which reads as the feature being broken rather than as a
    // stale cache. The list is small; fetching it again costs nothing.
    refetchOnWindowFocus: true,
  })
}

export function useSection(id: number | undefined) {
  return useQuery({
    queryKey: sectionKeys.one(id ?? 0),
    queryFn: () => api.get<{ section: Section }>(`${PATH}/${id}`),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useProductSections(productId: number | undefined) {
  return useQuery({
    queryKey: sectionKeys.forProduct(productId ?? 0),
    queryFn: () => api.get<{ sections: AttachedSection[] }>(`/products/${productId}/sections`),
    enabled: typeof productId === 'number' && productId > 0,
  })
}

/**
 * Every write invalidates the whole `sections` tree.
 *
 * Editing a shared section changes every product it is attached to, so a
 * narrower invalidation would leave another product's card showing the old
 * heading — which is exactly the confusion that sharing is supposed to avoid.
 */
/**
 * Generic over the *result* as well as the variables.
 *
 * Typing the callback as `Promise<unknown>` erases what each mutation returns,
 * so every caller that reads `result.section.id` to navigate to the thing it
 * just made fails to compile — which is how `tsc -b`, and therefore the
 * production build, came to be broken while the dev server was perfectly happy.
 */
function useSectionMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sectionKeys.all })
    },
  })
}

export function useCreateSection() {
  return useSectionMutation((input: SectionInput) =>
    api.post<{ section: Section }>(PATH, input, { idempotencyKey: crypto.randomUUID() }),
  )
}

export function useUpdateSection() {
  return useSectionMutation(({ id, input }: { id: number; input: Partial<SectionInput> }) =>
    api.patch<{ section: Section }>(`${PATH}/${id}`, input),
  )
}

export function useDeleteSection() {
  return useSectionMutation((id: number) => api.delete<{ deleted: boolean }>(`${PATH}/${id}`))
}

export function useAddBlock() {
  return useSectionMutation(({ sectionId, input }: { sectionId: number; input: BlockInput }) =>
    api.post<{ section: Section }>(`${PATH}/${sectionId}/blocks`, input),
  )
}

export function useUpdateBlock() {
  return useSectionMutation(
    ({
      sectionId,
      blockId,
      input,
    }: {
      sectionId: number
      blockId: number
      input: Partial<BlockInput>
    }) => api.patch<{ section: Section }>(`${PATH}/${sectionId}/blocks/${blockId}`, input),
  )
}

export function useDeleteBlock() {
  return useSectionMutation(({ sectionId, blockId }: { sectionId: number; blockId: number }) =>
    api.delete<{ section: Section }>(`${PATH}/${sectionId}/blocks/${blockId}`),
  )
}

export function useReorderBlocks() {
  return useSectionMutation(({ sectionId, ids }: { sectionId: number; ids: number[] }) =>
    api.put<{ section: Section }>(`${PATH}/${sectionId}/blocks/order`, { ids }),
  )
}

/** Hotspots are saved as a set: the editor is a picture people drag dots on. */
export function useSetHotspots() {
  return useSectionMutation(
    ({
      sectionId,
      blockId,
      hotspots,
    }: {
      sectionId: number
      blockId: number
      hotspots: HotspotInput[]
    }) => api.put<{ section: Section }>(`${PATH}/${sectionId}/blocks/${blockId}/hotspots`, { hotspots }),
  )
}

// ── what is attached to a product ───────────────────────────────────────────
export function useAttachSection() {
  return useSectionMutation(({ productId, sectionId }: { productId: number; sectionId: number }) =>
    api.post<{ sections: AttachedSection[] }>(`/products/${productId}/sections`, {
      section_id: sectionId,
    }),
  )
}

export function useDetachSection() {
  return useSectionMutation(
    ({ productId, assignmentId }: { productId: number; assignmentId: number }) =>
      api.delete<{ sections: AttachedSection[] }>(`/products/${productId}/sections/${assignmentId}`),
  )
}

export function useUpdateAssignment() {
  return useSectionMutation(
    ({
      productId,
      assignmentId,
      input,
    }: {
      productId: number
      assignmentId: number
      input: { is_enabled?: boolean }
    }) => api.patch<{ sections: AttachedSection[] }>(`/products/${productId}/sections/${assignmentId}`, input),
  )
}

export function useReorderSections() {
  return useSectionMutation(({ productId, ids }: { productId: number; ids: number[] }) =>
    api.put<{ sections: AttachedSection[] }>(`/products/${productId}/sections/order`, { ids }),
  )
}
