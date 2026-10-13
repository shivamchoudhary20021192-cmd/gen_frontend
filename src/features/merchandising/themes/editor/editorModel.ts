import type {
  AppBlock,
  BlockDefinition,
  JsonTemplate,
  SectionPreset,
  SectionSchema,
  SettingDefinition,
  SettingValue,
  TemplateBlock,
  TemplateSection,
} from '../themeTypes'

/**
 * The theme editor's edits, as pure functions over JSON templates and section
 * groups — the same documents the code editor shows. The editor never holds a
 * private model of the page: what it changes is exactly what gets saved.
 */

/** Where a section lives: the page's template, or a group the layout shows (header, footer). */
export interface Target {
  kind: 'template' | 'group'
  /** The file: templates/product.json, sections/header-group.json. */
  file: string
  /** For a group: its type ("header"); for a template: the template type ("product"). */
  scope: string
}

export const MAX_SECTIONS = 25

/** Section and block ids like Shopify's: readable, unique within the file. */
export function newId(type: string, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  const base = type.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'section'
  for (;;) {
    const id = `${base}_${Math.random().toString(36).slice(2, 8)}`
    if (!used.has(id)) return id
  }
}

const LABEL_KEYS = ['heading', 'title', 'text', 'name', 'label', 'caption', 'value', 'quote', 'button_label']

function plain(value: SettingValue | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? (text.length > 40 ? `${text.slice(0, 38)}…` : text) : null
}

/** What a block is called in the tree: its heading or title if it has one, as Shopify does. */
export function blockLabel(block: TemplateBlock, definition: BlockDefinition | undefined): string {
  for (const key of LABEL_KEYS) {
    const label = plain(block.settings?.[key])
    if (label) return label
  }
  return definition?.name ?? block.type
}

export function sectionLabel(section: TemplateSection, schema: SectionSchema | undefined): string {
  return schema?.name ?? section.type
}

/** A setting's value, falling back to its schema default. */
export function valueOf(definition: SettingDefinition, saved: Record<string, SettingValue> | undefined): SettingValue {
  if (!definition.id) return null
  if (saved && definition.id in saved) return saved[definition.id]
  return definition.default ?? (definition.type === 'checkbox' ? false : null)
}

/**
 * Whether "Add section" may offer this section here. Shopify's rules: it
 * needs a preset, and its enabled_on / disabled_on must allow this template
 * or group.
 */
export function canAdd(type: string, schema: SectionSchema, target: Target, current: JsonTemplate): boolean {
  if (!schema.presets?.length) return false
  const key = target.kind === 'group' ? 'groups' : 'templates'
  const enabled = schema.enabled_on?.[key]
  const disabled = schema.disabled_on?.[key]
  if (schema.enabled_on && !enabled) return false
  if (enabled && !enabled.includes('*') && !enabled.includes(target.scope)) return false
  if (disabled && (disabled.includes('*') || disabled.includes(target.scope))) return false
  if (schema.limit !== undefined) {
    const used = Object.values(current.sections).filter((section) => section.type === type).length
    if (used >= schema.limit) return false
  }
  return true
}

function blocksFromPreset(schema: SectionSchema, preset: SectionPreset | undefined, taken: Set<string>) {
  const blocks: Record<string, TemplateBlock> = {}
  const order: string[] = []
  for (const block of preset?.blocks ?? []) {
    if (!schema.blocks?.some((definition) => definition.type === block.type)) continue
    const id = newId(block.type, taken)
    taken.add(id)
    blocks[id] = { type: block.type, settings: { ...(block.settings ?? {}) } }
    order.push(id)
  }
  return { blocks, order }
}

/** Inserts a section from a preset, after `afterId` (or at the end). Returns the new id. */
export function addSection(template: JsonTemplate, type: string, schema: SectionSchema, presetIndex: number, afterId?: string | null): { template: JsonTemplate; id: string } {
  const preset = schema.presets?.[presetIndex]
  const id = newId(type, Object.keys(template.sections))
  const taken = new Set<string>()
  const { blocks, order } = blocksFromPreset(schema, preset, taken)
  const section: TemplateSection = { type, settings: { ...(preset?.settings ?? {}) } }
  if (order.length) {
    section.blocks = blocks
    section.block_order = order
  }
  const at = afterId ? template.order.indexOf(afterId) + 1 : template.order.length
  const nextOrder = [...template.order]
  nextOrder.splice(at <= 0 ? template.order.length : at, 0, id)
  return { template: { ...template, sections: { ...template.sections, [id]: section }, order: nextOrder }, id }
}

export function removeSection(template: JsonTemplate, id: string): JsonTemplate {
  const sections = { ...template.sections }
  delete sections[id]
  return { ...template, sections, order: template.order.filter((key) => key !== id) }
}

export function duplicateSection(template: JsonTemplate, id: string): { template: JsonTemplate; id: string } {
  const source = template.sections[id]
  const copyId = newId(source.type, Object.keys(template.sections))
  const copy: TemplateSection = JSON.parse(JSON.stringify(source))
  const order = [...template.order]
  order.splice(order.indexOf(id) + 1, 0, copyId)
  return { template: { ...template, sections: { ...template.sections, [copyId]: copy }, order }, id: copyId }
}

export function updateSection(template: JsonTemplate, id: string, change: (section: TemplateSection) => TemplateSection): JsonTemplate {
  return { ...template, sections: { ...template.sections, [id]: change(template.sections[id]) } }
}

export function setSectionSetting(template: JsonTemplate, id: string, key: string, value: SettingValue): JsonTemplate {
  return updateSection(template, id, (section) => ({ ...section, settings: { ...(section.settings ?? {}), [key]: value } }))
}

export function toggleSection(template: JsonTemplate, id: string): JsonTemplate {
  return updateSection(template, id, (section) => {
    const next = { ...section }
    if (next.disabled) delete next.disabled
    else next.disabled = true
    return next
  })
}

export function moveInOrder(order: string[], id: string, toIndex: number): string[] {
  const next = order.filter((key) => key !== id)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id)
  return next
}

export function blockOrder(section: TemplateSection): string[] {
  return section.block_order ?? Object.keys(section.blocks ?? {})
}

export function canAddBlock(section: TemplateSection, schema: SectionSchema, type: string): boolean {
  const blocks = Object.values(section.blocks ?? {})
  if (schema.max_blocks !== undefined && blocks.length >= schema.max_blocks) return false
  const definition = schema.blocks?.find((block) => block.type === type)
  if (definition?.limit !== undefined && blocks.filter((block) => block.type === type).length >= definition.limit) return false
  return Boolean(definition)
}

export function addBlock(template: JsonTemplate, sectionId: string, type: string): { template: JsonTemplate; id: string } {
  const section = template.sections[sectionId]
  const id = newId(type, Object.keys(section.blocks ?? {}))
  return {
    template: updateSection(template, sectionId, (current) => ({
      ...current,
      blocks: { ...(current.blocks ?? {}), [id]: { type, settings: {} } },
      block_order: [...blockOrder(current), id],
    })),
    id,
  }
}

export function removeBlock(template: JsonTemplate, sectionId: string, blockId: string): JsonTemplate {
  return updateSection(template, sectionId, (section) => {
    const blocks = { ...(section.blocks ?? {}) }
    delete blocks[blockId]
    return { ...section, blocks, block_order: blockOrder(section).filter((id) => id !== blockId) }
  })
}

export function duplicateBlock(template: JsonTemplate, sectionId: string, blockId: string): { template: JsonTemplate; id: string } {
  const section = template.sections[sectionId]
  const source = section.blocks?.[blockId]
  if (!source) return { template, id: blockId }
  const id = newId(source.type, Object.keys(section.blocks ?? {}))
  const order = blockOrder(section)
  order.splice(order.indexOf(blockId) + 1, 0, id)
  return {
    template: updateSection(template, sectionId, (current) => ({ ...current, blocks: { ...(current.blocks ?? {}), [id]: JSON.parse(JSON.stringify(source)) }, block_order: order })),
    id,
  }
}

export function setBlockSetting(template: JsonTemplate, sectionId: string, blockId: string, key: string, value: SettingValue): JsonTemplate {
  return updateSection(template, sectionId, (section) => {
    const block = section.blocks?.[blockId]
    if (!block) return section
    return { ...section, blocks: { ...(section.blocks ?? {}), [blockId]: { ...block, settings: { ...(block.settings ?? {}), [key]: value } } } }
  })
}

export function toggleBlock(template: JsonTemplate, sectionId: string, blockId: string): JsonTemplate {
  return updateSection(template, sectionId, (section) => {
    const block = section.blocks?.[blockId]
    if (!block) return section
    const next = { ...block }
    if (next.disabled) delete next.disabled
    else next.disabled = true
    return { ...section, blocks: { ...(section.blocks ?? {}), [blockId]: next } }
  })
}

export function moveBlock(template: JsonTemplate, sectionId: string, blockId: string, toIndex: number): JsonTemplate {
  return updateSection(template, sectionId, (section) => ({ ...section, block_order: moveInOrder(blockOrder(section), blockId, toIndex) }))
}

/** The JSON a template or group is saved as: stable key order, two-space indent. */
export function serialise(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/** Friendly names for the template picker's groups. */
export const TEMPLATE_GROUPS: { type: string; label: string }[] = [
  { type: 'index', label: 'Home page' },
  { type: 'product', label: 'Products' },
  { type: 'collection', label: 'Collections' },
  { type: 'list-collections', label: 'Collections list' },
  { type: 'page', label: 'Pages' },
  { type: 'blog', label: 'Blogs' },
  { type: 'article', label: 'Blog posts' },
  { type: 'cart', label: 'Cart' },
  { type: 'search', label: 'Search' },
  { type: '404', label: '404 page' },
  { type: 'password', label: 'Password' },
  { type: 'customers/login', label: 'Customer sign in' },
  { type: 'customers/register', label: 'Customer sign up' },
  { type: 'customers/account', label: 'Customer account' },
  { type: 'customers/order', label: 'Customer order' },
  { type: 'customers/addresses', label: 'Customer addresses' },
]

/**
 * The schemas the editor works with: each section that accepts app blocks
 * ({"type": "@app"}) lists the installed apps' blocks in place of "@app", so
 * adding, selecting and configuring an app block is the same as any block.
 */
export function withAppBlocks(schemas: Record<string, SectionSchema>, appBlocks: AppBlock[]): Record<string, SectionSchema> {
  const forSections = appBlocks.filter((block) => block.target === 'section')
  const out: Record<string, SectionSchema> = {}
  for (const [type, schema] of Object.entries(schemas)) {
    if (!schema.blocks?.some((block) => block.type === '@app')) {
      out[type] = schema
      continue
    }
    out[type] = {
      ...schema,
      blocks: [
        ...schema.blocks.filter((block) => block.type !== '@app'),
        ...forSections.map((block) => ({ type: block.type, name: block.name, app: block.app.name, settings: block.settings })),
      ],
    }
  }
  return out
}

/** The id an app embed is kept under in settings_data.json: one per block type. */
export function embedId(block: AppBlock): string {
  const [, , , app = 'app', , handle = 'embed'] = block.type.split('/')
  return `${app}-${handle}`.replace(/[^a-z0-9_-]/gi, '_')
}
