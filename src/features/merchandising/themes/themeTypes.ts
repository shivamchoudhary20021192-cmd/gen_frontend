/**
 * Online Store themes, as the Admin API returns them. A theme is a bundle of
 * files (Shopify's Online Store 2.0 layout); these types describe the parts
 * the admin works with: installed themes, the theme store, and the editor's
 * view of one template.
 */

export type SettingValue = string | number | boolean | null | string[]

export interface InstalledTheme {
  id: string
  name: string
  role: 'main' | 'unpublished' | 'development'
  theme: string
  theme_name: string
  version: string
  latest_version: string
  update_available: boolean
  preset: string | null
  source: 'library' | 'duplicate' | 'upload'
  processing: 'ready' | 'installing' | 'failed'
  files_version: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ThemePreset {
  key: string
  name: string
  settings: Record<string, SettingValue>
  /** The preset's resolved colours, fonts and button shape — for thumbnails. */
  style?: Record<string, SettingValue>
}

export interface LibraryTheme {
  handle: string
  name: string
  author: string
  version: string
  description: string
  verticals: string[]
  features: string[]
  industries: string[]
  recommended: boolean
  preview_image_url: string | null
  demo_url: string | null
  price: { amount: number; currency: string }
  section_count: number
  presets: ThemePreset[]
  /** Real pages of the theme, per style key, where they have been captured. */
  screenshots?: Record<string, { desktop: string | null; mobile: string | null }>
}

export interface PreviewUrls {
  origin: string
  path: string
  /** The theme editor's frame: drafts, outlines and editor events. */
  design_url: string
  /** A shareable link to the theme as saved. */
  preview_url: string
}

/** One setting in a {% schema %} or in config/settings_schema.json. */
export interface SettingDefinition {
  type: string
  id?: string
  label?: string
  default?: SettingValue
  info?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  unit?: string
  content?: string
  accept?: string[]
  limit?: number
}

export interface BlockDefinition {
  type: string
  name: string
  limit?: number
  settings?: SettingDefinition[]
  /** For an app block: the app that provides it. */
  app?: string
}

/** A block from an installed app's theme extension. */
export interface AppBlock {
  /** shopify://apps/<app>/blocks/<block>/<app id> */
  type: string
  name: string
  /** 'section': an "@app" block a section can hold; 'head' | 'body': an app embed. */
  target: 'section' | 'head' | 'body'
  app: { id: string; name: string; handle: string }
  settings: SettingDefinition[]
}

/** An app embed as settings_data.json keeps it, under current.blocks. */
export interface AppEmbedEntry {
  type: string
  disabled?: boolean
  settings?: Record<string, SettingValue>
}

export interface SectionPreset {
  name: string
  category?: string
  settings?: Record<string, SettingValue>
  blocks?: { type: string; settings?: Record<string, SettingValue> }[]
}

export interface SectionSchema {
  name: string
  tag?: string
  class?: string
  limit?: number
  settings?: SettingDefinition[]
  blocks?: BlockDefinition[]
  max_blocks?: number
  presets?: SectionPreset[]
  default?: SectionPreset
  enabled_on?: { templates?: string[]; groups?: string[] }
  disabled_on?: { templates?: string[]; groups?: string[] }
}

export interface TemplateBlock {
  type: string
  settings?: Record<string, SettingValue>
  disabled?: boolean
}

export interface TemplateSection {
  type: string
  settings?: Record<string, SettingValue>
  blocks?: Record<string, TemplateBlock>
  block_order?: string[]
  disabled?: boolean
}

export interface JsonTemplate {
  layout?: string | false
  wrapper?: string
  sections: Record<string, TemplateSection>
  order: string[]
}

export interface SectionGroup extends JsonTemplate {
  type: string
  name: string
}

export interface TemplateRef {
  key: string
  type: string
  suffix: string | null
  file: string
  json: boolean
  label: string
}

export interface EditorState {
  theme: { id: string; name: string; role: InstalledTheme['role']; theme: string; version: string; theme_name: string }
  templates: TemplateRef[]
  template: (TemplateRef & { data: JsonTemplate | null }) | null
  groups: { name: string; file: string; data: SectionGroup | null }[]
  schemas: Record<string, SectionSchema>
  settings_schema: { name: string; settings?: SettingDefinition[] }[]
  settings: Record<string, SettingValue>
  /** config/settings_data.json as a whole: saving settings keeps its styles. */
  settings_data: { current: Record<string, SettingValue> | string; presets?: Record<string, Record<string, SettingValue>> }
  presets: string[]
  drafts: string[]
  preview: PreviewUrls
  /** Blocks from installed apps. */
  app_blocks?: AppBlock[]
}

export interface ThemeDetail {
  theme: InstalledTheme
  settings_schema: { name: string; settings?: SettingDefinition[] }[]
  presets: ThemePreset[]
  overrides: Record<string, SettingValue>
  settings: Record<string, SettingValue>
  preview: PreviewUrls
}

export interface ThemeFile {
  path: string
  size: number
  content_type: string
  checksum: string
  updated_at: string
  has_draft: boolean
  required: boolean
}

export interface ThemeFileContent {
  path: string
  content: string | null
  url: string | null
  content_type: string
  checksum: string
  size: number
  updated_at: string
}

export interface FileVersion {
  id: number
  source: 'install' | 'editor' | 'code' | 'upgrade' | 'restore' | 'api'
  checksum: string
  created_at: string
  created_by_admin_id: number | null
}

export interface ThemeResource {
  handle: string
  title: string
  image: string | null
  hint: string | null
}

export const themeKeys = {
  all: ['themes'] as const,
  list: ['themes', 'list'] as const,
  library: ['themes', 'library'] as const,
  detail: (id: string) => ['themes', 'detail', id] as const,
  editor: (id: string, template: string) => ['themes', 'editor', id, template] as const,
  files: (id: string) => ['themes', 'files', id] as const,
  file: (id: string, path: string) => ['themes', 'file', id, path] as const,
  versions: (id: string, path: string) => ['themes', 'versions', id, path] as const,
  resources: (type: string, term: string) => ['themes', 'resources', type, term] as const,
}
