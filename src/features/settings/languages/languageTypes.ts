export interface Language {
  code: string
  name: string
  endonym: string
  rtl: boolean
  primary: boolean
  published: boolean
  root_url: string
  preview_url: string
  /** Whether the built-in themes ship their own words (buttons, labels) in this language. */
  theme_strings: boolean
}

export interface AvailableLanguage {
  code: string
  name: string
  endonym: string
  theme: boolean
}

export interface LanguagesResponse {
  primary: Language
  languages: Language[]
  available: AvailableLanguage[]
}

export type ResourceKind = 'product' | 'collection' | 'page' | 'article' | 'link' | 'theme'

export interface TranslationField {
  key: string
  label: string
  format: 'text' | 'html' | 'multiline'
  original: string
  translation: string
  outdated: boolean
}

export interface TranslatableResource {
  id: number
  key: string
  title: string
  subtitle: string | null
  fields: TranslationField[]
  translated: number
}

export interface TranslationsResponse {
  language: Language
  kind: ResourceKind
  pagination: { page: number; limit: number; total: number; pages: number }
  resources: TranslatableResource[]
}

export const languagesKey = ['online-store', 'languages'] as const
