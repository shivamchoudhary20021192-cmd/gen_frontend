import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

/**
 * The page builder.
 *
 * The important idea here is that this file knows almost nothing about
 * sections. What a "hero" is, which fields it has, what a "media_products"
 * section may hold — all of that arrives from `/content/page-builder/catalogue`
 * and the editing form is generated from it. Adding a section kind to the
 * backend therefore puts it in this screen with no frontend release at all,
 * which is the only way a builder with fifteen kinds stays maintainable.
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'select'
  | 'toggle'
  | 'number'
  | 'color'
  | 'media'
  | 'product'
  | 'collection'
  | 'shelf'
  | 'link'
  | 'icon'

/** Which panel of the settings pane a field belongs in. Set by the API. */
export type FieldGroup = 'content' | 'layout' | 'style' | 'schedule'

export interface Field {
  key: string
  label: string
  kind: FieldKind
  group?: FieldGroup
  help?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  default?: unknown
  accepts?: 'image' | 'video' | 'any'
}

export interface BlockSchema {
  key: string
  label: string
  help?: string
  fields: Field[]
  max?: number
}

export interface SectionSchema {
  key: string
  label: string
  description: string
  group: 'hero' | 'products' | 'story' | 'media' | 'utility'
  settings: Field[]
  blocks: BlockSchema[]
  max_blocks: number | null
}

export interface BuilderBlock {
  id: number
  key: string
  settings: Record<string, unknown>
  is_enabled: boolean
}

export interface BuilderSection {
  id: number
  key: string
  /** The catalogue's name for the kind — "Hero", "Picture with products". */
  label: string
  /** The author's own name for this instance. */
  name: string
  settings: Record<string, unknown>
  is_enabled: boolean
  visible_from: string | null
  visible_until: string | null
  sort_order: number
  /** Why this section is not on the site, in plain words, or null when it is. */
  hidden_because: string | null
  blocks: BuilderBlock[]
}

export interface BuilderPage {
  template: { id: number; key: string; name: string }
  sections: BuilderSection[]
}

const PATH = '/content/page-builder'

export const builderKeys = {
  catalogue: ['page-builder', 'catalogue'] as const,
  templates: ['page-builder', 'templates'] as const,
  page: (key: string) => ['page-builder', 'page', key] as const,
}

/** This build's vocabulary. Rarely changes, so it is cached hard. */
export function useSectionCatalogue() {
  return useQuery({
    queryKey: builderKeys.catalogue,
    queryFn: () => api.get<{ sections: SectionSchema[] }>(`${PATH}/catalogue`),
    staleTime: 10 * 60 * 1000,
  })
}

export function usePageTemplates() {
  return useQuery({
    queryKey: builderKeys.templates,
    queryFn: () => api.get<{ templates: { id: number; key: string; name: string; description: string | null }[] }>(
      `${PATH}/templates`,
    ),
    staleTime: 10 * 60 * 1000,
  })
}

export function useBuilderPage(templateKey: string) {
  return useQuery({
    queryKey: builderKeys.page(templateKey),
    queryFn: () => api.get<BuilderPage>(`${PATH}/templates/${templateKey}`),
  })
}

/**
 * Every write invalidates the page and nothing else.
 *
 * The catalogue cannot change from this screen, and invalidating it would
 * refetch fifteen schemas on every keystroke-debounced save.
 */
function usePageMutation<TVariables, TResult>(
  templateKey: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: builderKeys.page(templateKey) })
    },
  })
}

export function useAddSection(templateKey: string) {
  return usePageMutation(
    templateKey,
    ({ sectionKey, afterSectionId }: { sectionKey: string; afterSectionId?: number | null }) =>
      api.post<{ section_id: number }>(`${PATH}/templates/${templateKey}/sections`, {
        section_key: sectionKey,
        after_section_id: afterSectionId ?? undefined,
      }),
  )
}

/** A copy of a section, blocks included, directly after it. */
export function useDuplicateSection(templateKey: string) {
  return usePageMutation(templateKey, (id: number) =>
    api.post<{ section_id: number }>(`${PATH}/sections/${id}/duplicate`, {}),
  )
}

export function useReorderSections(templateKey: string) {
  return usePageMutation(templateKey, (sectionIds: number[]) =>
    api.put(`${PATH}/templates/${templateKey}/order`, { section_ids: sectionIds }),
  )
}

export function useUpdateSection(templateKey: string) {
  return usePageMutation(
    templateKey,
    ({ id, input }: { id: number; input: Record<string, unknown> }) => api.patch(`${PATH}/sections/${id}`, input),
  )
}

export function useDeleteSection(templateKey: string) {
  return usePageMutation(templateKey, (id: number) => api.delete(`${PATH}/sections/${id}`))
}

export function useAddBlock(templateKey: string) {
  return usePageMutation(templateKey, ({ sectionId, blockKey }: { sectionId: number; blockKey: string }) =>
    api.post<{ block_id: number }>(`${PATH}/sections/${sectionId}/blocks`, { block_key: blockKey }),
  )
}

export function useUpdateBlock(templateKey: string) {
  return usePageMutation(
    templateKey,
    ({ sectionId, blockId, settings }: { sectionId: number; blockId: number; settings: Record<string, unknown> }) =>
      api.patch(`${PATH}/sections/${sectionId}/blocks/${blockId}`, settings),
  )
}

export function useDeleteBlock(templateKey: string) {
  return usePageMutation(templateKey, ({ sectionId, blockId }: { sectionId: number; blockId: number }) =>
    api.delete(`${PATH}/sections/${sectionId}/blocks/${blockId}`),
  )
}

export function useReorderBlocks(templateKey: string) {
  return usePageMutation(templateKey, ({ sectionId, blockIds }: { sectionId: number; blockIds: number[] }) =>
    api.put(`${PATH}/sections/${sectionId}/blocks/order`, { block_ids: blockIds }),
  )
}

/**
 * Where the headless storefront lives, for the preview frame — or null when
 * there is none to frame.
 *
 * Page builder sections are drawn by the headless (React) storefront; Online
 * Store themes do not show them, so only that app can preview them. An env var
 * rather than a guess: in development it is that app's Vite server, in
 * production wherever it is deployed, and the admin has no way to work that
 * out for itself.
 *
 * The admin's own origin is never a storefront. Vite moves to the next free
 * port when its own is taken, which can be exactly the one the storefront was
 * expected on — and framing it showed the admin inside itself.
 */
const CONFIGURED_STOREFRONT =
  (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5174'

export function headlessStorefrontUrl(): string | null {
  try {
    return new URL(CONFIGURED_STOREFRONT).origin === window.location.origin ? null : CONFIGURED_STOREFRONT
  } catch {
    return null
  }
}
