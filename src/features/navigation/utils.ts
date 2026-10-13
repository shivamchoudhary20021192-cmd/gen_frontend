/**
 * Utility functions for Navigation module (CMS Menus)
 */

import type {
  LinkType,
  MenuItemTreeNode,
  MenuItemWithMedia,
  FlatMenuItem,
  BulkReorderMenuItemsDto,
} from './types'
import { LINK_TYPE_LABELS } from './types'

// ── Label Getters ────────────────────────────────────────────────────────────

export function getLinkTypeLabel(linkType: LinkType): string {
  return LINK_TYPE_LABELS[linkType] || linkType
}

// ── Slug Generation ──────────────────────────────────────────────────────────

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateMenuName(name: string): string | null {
  if (!name || !name.trim()) {
    return 'Menu name is required'
  }

  if (name.length > 100) {
    return 'Menu name must be 100 characters or less'
  }

  return null
}

export function validateMenuItemLabel(label: string): string | null {
  if (!label || !label.trim()) {
    return 'Label is required'
  }

  if (label.length > 100) {
    return 'Label must be 100 characters or less'
  }

  return null
}

export function validateUrl(url: string): string | null {
  if (!url || !url.trim()) {
    return 'URL is required'
  }

  try {
    new URL(url)
    return null
  } catch {
    return 'Invalid URL format'
  }
}

export function validateMenuItem(
  linkType: LinkType,
  url: string | null,
  linkRefId: number | null
): string | null {
  if (linkType === 'url') {
    if (!url) {
      return 'URL is required for external link type'
    }
    return validateUrl(url)
  }

  if (linkType === 'none') {
    // Non-clickable parent items don't need URL or ref_id
    return null
  }

  if (!linkRefId) {
    return `Reference ID is required for ${getLinkTypeLabel(linkType)} link type`
  }

  return null
}

export function validateSlug(slug: string): string | null {
  if (!slug || !slug.trim()) {
    return 'Slug is required'
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Slug can only contain lowercase letters, numbers, and hyphens'
  }

  if (slug.length > 140) {
    return 'Slug must be 140 characters or less'
  }

  return null
}

// ── Tree Operations ──────────────────────────────────────────────────────────

/**
 * Build a flat list from tree structure (inverse of backend buildTree)
 * Useful for drag-and-drop operations
 */
export function buildFlatListFromTree(
  nodes: MenuItemTreeNode[],
  parentId: number | null = null,
  level: number = 0
): FlatMenuItem[] {
  const result: FlatMenuItem[] = []

  nodes.forEach((node, index) => {
    result.push({
      id: node.id,
      parent_id: parentId,
      sort_order: index * 10,
      level,
    })

    if (node.children && node.children.length > 0) {
      result.push(...buildFlatListFromTree(node.children, node.id, level + 1))
    }
  })

  return result
}

/**
 * Find a node in tree by ID
 */
export function findNodeInTree(
  nodes: MenuItemTreeNode[],
  id: number
): MenuItemTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }

    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
  }

  return null
}

/**
 * Get all node IDs in a subtree (including the node itself)
 */
export function getSubtreeIds(node: MenuItemTreeNode): number[] {
  const ids = [node.id]

  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      ids.push(...getSubtreeIds(child))
    })
  }

  return ids
}

/**
 * Check if moving a node would create a circular reference
 */
export function wouldCreateCycle(
  nodeId: number,
  newParentId: number | null,
  tree: MenuItemTreeNode[]
): boolean {
  if (newParentId === null) {
    return false // Moving to root is always safe
  }

  if (nodeId === newParentId) {
    return true // Can't be parent of itself
  }

  const node = findNodeInTree(tree, nodeId)
  if (!node) {
    return false // Node not found, can't determine
  }

  // Check if newParentId is in the subtree of nodeId
  const subtreeIds = getSubtreeIds(node)
  return subtreeIds.includes(newParentId)
}

/**
 * Get max depth of tree
 */
export function getMaxDepth(nodes: MenuItemTreeNode[], currentDepth: number = 0): number {
  if (!nodes || nodes.length === 0) {
    return currentDepth
  }

  let maxDepth = currentDepth

  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      const childDepth = getMaxDepth(node.children, currentDepth + 1)
      maxDepth = Math.max(maxDepth, childDepth)
    }
  })

  return maxDepth
}

/**
 * Count total items in tree
 */
export function countTreeItems(nodes: MenuItemTreeNode[]): number {
  let count = nodes.length

  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      count += countTreeItems(node.children)
    }
  })

  return count
}

// ── Drag & Drop Operations ───────────────────────────────────────────────────

/**
 * Reorder tree nodes after drag-and-drop
 * Returns the updates array for bulkReorder API call
 */
export function reorderTreeNodes(
  items: MenuItemWithMedia[],
  draggedId: number,
  newParentId: number | null,
  newIndex: number
): BulkReorderMenuItemsDto {
  // Group items by parent
  const itemsByParent = new Map<number | null, MenuItemWithMedia[]>()
  
  items.forEach((item) => {
    const parentKey = item.parent_id
    if (!itemsByParent.has(parentKey)) {
      itemsByParent.set(parentKey, [])
    }
    itemsByParent.get(parentKey)!.push(item)
  })

  // Sort each group by sort_order
  itemsByParent.forEach((siblings) => {
    siblings.sort((a, b) => a.sort_order - b.sort_order)
  })

  const updates: Array<{ id: number; parent_id: number | null; sort_order: number }> = []

  // Find the dragged item
  const draggedItem = items.find((item) => item.id === draggedId)
  if (!draggedItem) {
    return { updates: [] }
  }

  const oldParentId = draggedItem.parent_id

  // If parent changed, update all siblings in old parent
  if (oldParentId !== newParentId) {
    const oldSiblings = itemsByParent.get(oldParentId) || []
    oldSiblings
      .filter((item) => item.id !== draggedId)
      .forEach((item, index) => {
        updates.push({
          id: item.id,
          parent_id: oldParentId,
          sort_order: index * 10,
        })
      })
  }

  // Update siblings in new parent (including dragged item)
  const newSiblings = (itemsByParent.get(newParentId) || [])
    .filter((item) => item.id !== draggedId)

  newSiblings.splice(newIndex, 0, draggedItem)

  newSiblings.forEach((item, index) => {
    updates.push({
      id: item.id,
      parent_id: newParentId,
      sort_order: index * 10,
    })
  })

  return { updates }
}

// ── Display Helpers ──────────────────────────────────────────────────────────

export function getIndentationStyle(level: number): React.CSSProperties {
  return {
    paddingLeft: `${level * 24}px`,
  }
}

export function getBadgeColor(badgeLabel: string | null): string {
  if (!badgeLabel) return '#757575'

  const label = badgeLabel.toLowerCase()
  if (label.includes('new')) return '#2196F3'
  if (label.includes('sale')) return '#F44336'
  if (label.includes('hot')) return '#FF5722'
  if (label.includes('featured')) return '#9C27B0'

  return '#757575'
}

// ── Text Helpers ─────────────────────────────────────────────────────────────

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// ── Status Helpers ───────────────────────────────────────────────────────────

export function getActiveStatusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive'
}

export function getActiveStatusColor(isActive: boolean): string {
  return isActive ? '#2E7D32' : '#757575'
}

// ── Tree Search ──────────────────────────────────────────────────────────────

export function searchTree(nodes: MenuItemTreeNode[], search: string): MenuItemTreeNode[] {
  if (!search) return nodes

  const searchLower = search.toLowerCase()
  const results: MenuItemTreeNode[] = []

  function matchesSearch(node: MenuItemTreeNode): boolean {
    return (
      node.label.toLowerCase().includes(searchLower) ||
      node.description?.toLowerCase().includes(searchLower) ||
      node.url?.toLowerCase().includes(searchLower) ||
      false
    )
  }

  function hasMatchingDescendant(node: MenuItemTreeNode): boolean {
    if (matchesSearch(node)) return true

    if (node.children && node.children.length > 0) {
      return node.children.some(hasMatchingDescendant)
    }

    return false
  }

  nodes.forEach((node) => {
    if (hasMatchingDescendant(node)) {
      const filteredNode = { ...node }

      if (node.children && node.children.length > 0) {
        filteredNode.children = searchTree(node.children, search)
      }

      results.push(filteredNode)
    }
  })

  return results
}

// ── Tree Filtering ───────────────────────────────────────────────────────────

export function filterTreeByLinkType(
  nodes: MenuItemTreeNode[],
  linkType: LinkType | null
): MenuItemTreeNode[] {
  if (!linkType) return nodes

  const results: MenuItemTreeNode[] = []

  nodes.forEach((node) => {
    if (node.link_type === linkType) {
      results.push(node)
    } else if (node.children && node.children.length > 0) {
      const filteredChildren = filterTreeByLinkType(node.children, linkType)
      if (filteredChildren.length > 0) {
        results.push({
          ...node,
          children: filteredChildren,
        })
      }
    }
  })

  return results
}

export function filterTreeByActive(
  nodes: MenuItemTreeNode[],
  isActive: boolean | null
): MenuItemTreeNode[] {
  if (isActive === null) return nodes

  const results: MenuItemTreeNode[] = []

  nodes.forEach((node) => {
    if (node.is_active === isActive) {
      results.push(node)
    } else if (node.children && node.children.length > 0) {
      const filteredChildren = filterTreeByActive(node.children, isActive)
      if (filteredChildren.length > 0) {
        results.push({
          ...node,
          children: filteredChildren,
        })
      }
    }
  })

  return results
}

