# Navigation Module - Frontend

Admin UI for managing storefront navigation menus with drag-and-drop tree interface.

## Features

- ✅ Menu CRUD operations with validation
- ✅ Drag-and-drop tree interface for menu items
- ✅ 10 link types with dynamic form fields
- ✅ Hierarchical parent selection
- ✅ Circular reference prevention
- ✅ Media integration (icons & images)
- ✅ Badge labels for menu items
- ✅ Active/inactive status management
- ✅ System menu protection
- ✅ Expand/collapse tree nodes
- ✅ Real-time updates with React Query

## Installation

### Dependencies
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Already included:
- React Query (data fetching & caching)
- Material-UI (components)
- React Router (routing)

## Module Structure

```
src/features/navigation/
├── types.ts                    # TypeScript types & constants
├── api.ts                      # API client functions
├── useNavigation.ts            # React Query hooks
├── utils.ts                    # Utility functions
├── MenusListPage.tsx           # Menus list with grid layout
├── MenuItemsManagePage.tsx     # Tree interface with drag-and-drop
├── index.ts                    # Module exports
└── README.md                   # This file
```

## Quick Start

### 1. Add Routes
```typescript
import { MenusListPage, MenuItemsManagePage } from '@/features/navigation'

// In your router configuration
<Route path="/navigation/menus" element={<MenusListPage />} />
<Route path="/navigation/menus/:menuId/items" element={<MenuItemsManagePage />} />
```

### 2. Update Route Registry
```typescript
// In routeRegistry.ts
export const IMPLEMENTED_ROUTE_KEYS = new Set<string>([
  // ... other routes
  'navigation',           // Add this
  'navigation.menus',     // Add this
])
```

### 3. Configure Navigation Menu
Ensure the navigation menu items are configured in the database to show the navigation link in the admin sidebar.

## Usage Examples

### List Menus
```typescript
import { useMenus } from '@/features/navigation'

function MyComponent() {
  const { data, isLoading } = useMenus({ is_active: true })
  
  return (
    <div>
      {data?.data.map(menu => (
        <div key={menu.id}>{menu.name}</div>
      ))}
    </div>
  )
}
```

### Get Menu with Tree Structure
```typescript
import { useMenuWithItems } from '@/features/navigation'

function MenuTree({ menuId }: { menuId: number }) {
  const { data, isLoading } = useMenuWithItems(menuId)
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div>
      <h2>{data?.name}</h2>
      {data?.items.map(item => (
        <MenuItem key={item.id} item={item} />
      ))}
    </div>
  )
}
```

### Create Menu
```typescript
import { useCreateMenu } from '@/features/navigation'

function CreateMenuForm() {
  const createMutation = useCreateMenu()
  
  const handleSubmit = async (formData) => {
    try {
      await createMutation.mutateAsync({
        name: formData.name,
        slug: formData.slug,
        is_active: true,
      })
      // Success! React Query automatically invalidates and refetches
    } catch (error) {
      console.error('Failed to create menu:', error)
    }
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

### Create Menu Item
```typescript
import { useCreateMenuItem } from '@/features/navigation'

function CreateItemForm({ menuId }: { menuId: number }) {
  const createMutation = useCreateMenuItem()
  
  const handleSubmit = async (formData) => {
    await createMutation.mutateAsync({
      menu_id: menuId,
      label: formData.label,
      link_type: formData.linkType,
      url: formData.url,
      parent_id: formData.parentId,
      is_active: true,
    })
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

### Bulk Reorder (After Drag-and-Drop)
```typescript
import { useBulkReorderMenuItems } from '@/features/navigation'
import { reorderTreeNodes } from '@/features/navigation'

function DraggableTree({ items }: { items: MenuItemWithMedia[] }) {
  const bulkReorder = useBulkReorderMenuItems()
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    
    // Generate updates using utility function
    const updates = reorderTreeNodes(
      items,
      active.id as number,
      newParentId,
      newIndex
    )
    
    await bulkReorder.mutateAsync(updates)
  }
  
  return <DndContext onDragEnd={handleDragEnd}>...</DndContext>
}
```

## React Query Hooks

### Menus
- `useMenus(params?)` - List all menus
- `useMenu(id)` - Get menu by ID
- `useMenuBySlug(slug)` - Get menu by slug
- `useMenuWithItems(id)` - Get menu with tree structure
- `useCreateMenu()` - Create menu mutation
- `useUpdateMenu()` - Update menu mutation
- `useDeleteMenu()` - Delete menu mutation

### Menu Items
- `useMenuItems(params?)` - List menu items (filtered)
- `useMenuItem(id)` - Get menu item by ID
- `useCreateMenuItem()` - Create menu item mutation
- `useUpdateMenuItem()` - Update menu item mutation
- `useDeleteMenuItem()` - Delete menu item mutation
- `useBulkReorderMenuItems()` - Bulk reorder mutation

## Utility Functions

### Validation
```typescript
import {
  validateMenuName,
  validateMenuItemLabel,
  validateUrl,
  validateMenuItem,
  validateSlug,
} from '@/features/navigation'

const nameError = validateMenuName(name)
const labelError = validateMenuItemLabel(label)
const urlError = validateUrl(url)
const linkError = validateMenuItem(linkType, url, linkRefId)
const slugError = validateSlug(slug)
```

### Tree Operations
```typescript
import {
  buildFlatListFromTree,
  findNodeInTree,
  getSubtreeIds,
  wouldCreateCycle,
  getMaxDepth,
  countTreeItems,
} from '@/features/navigation'

// Flatten tree for drag-and-drop
const flatItems = buildFlatListFromTree(treeNodes)

// Find node by ID
const node = findNodeInTree(treeNodes, nodeId)

// Get all descendant IDs
const ids = getSubtreeIds(node)

// Check for circular reference
const hasCycle = wouldCreateCycle(nodeId, newParentId, treeNodes)

// Get max depth
const depth = getMaxDepth(treeNodes)

// Count total items
const count = countTreeItems(treeNodes)
```

### Display Helpers
```typescript
import {
  getLinkTypeLabel,
  getIndentationStyle,
  getBadgeColor,
  getActiveStatusLabel,
  getActiveStatusColor,
  truncateText,
} from '@/features/navigation'

// Link type label
const label = getLinkTypeLabel('collection') // "Collection"

// Indentation for hierarchical display
const style = getIndentationStyle(level) // { paddingLeft: '24px' }

// Badge color
const color = getBadgeColor('New') // '#2196F3'

// Status helpers
const statusLabel = getActiveStatusLabel(true) // "Active"
const statusColor = getActiveStatusColor(true) // '#2E7D32'

// Text truncation
const short = truncateText('Long text...', 20) // "Long text..."
```

### Slug Generation
```typescript
import { generateSlug } from '@/features/navigation'

const slug = generateSlug('Main Navigation') // "main-navigation"
```

## Link Types

The module supports 10 link types:

| Type | Label | Requires | Use Case |
|------|-------|----------|----------|
| `url` | External URL | `url` field | External links |
| `page` | CMS Page | `link_ref_id` | Internal pages |
| `category` | Category | `link_ref_id` | Product categories |
| `collection` | Collection | `link_ref_id` | Product collections |
| `product` | Product | `link_ref_id` | Direct product links |
| `article` | Article | `link_ref_id` | Blog articles |
| `policy` | Policy Page | `link_ref_id` | Policies (privacy, terms) |
| `ingredient` | Ingredient | `link_ref_id` | Ingredient pages |
| `routine` | Routine | `link_ref_id` | Routine pages |
| `none` | Non-clickable | - | Mega-menu headers |

### Dynamic Form Fields
```typescript
// The form automatically shows/hides fields based on link_type:

// For link_type = 'url':
<TextField label="URL" required />

// For link_type = 'page', 'category', 'collection', etc.:
<TextField label="Reference ID" type="number" required />

// For link_type = 'none':
// No URL or reference ID required
```

## Component Props

### MenusListPage
No props required. Uses React Router `useNavigate` for routing.

### MenuItemsManagePage
Requires route parameter:
```typescript
// Route: /navigation/menus/:menuId/items
const { menuId } = useParams<{ menuId: string }>()
```

## Styling

Components use Material-UI theme and custom tokens:

```typescript
import { tokens } from '@/theme'

// Common colors used:
tokens.ivory       // Light background
'primary.main'     // Primary actions
'success.main'     // Active status
'error.main'       // Delete actions
'text.secondary'   // Muted text
```

## Drag-and-Drop Implementation

Uses `@dnd-kit` for accessible drag-and-drop:

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

// Sensors for mouse and keyboard
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
)

// Tree items must be flattened for SortableContext
const flatItems = buildFlatListFromTree(treeNodes)

<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  <SortableContext items={flatItems.map(i => i.id)}>
    {/* Sortable items */}
  </SortableContext>
</DndContext>
```

## Best Practices

### 1. Always Validate Before Submit
```typescript
const handleSubmit = async () => {
  // Validate form
  if (!validateForm()) return
  
  // Check circular references when updating parent
  if (newParentId && wouldCreateCycle(itemId, newParentId, tree)) {
    setError('Cannot set parent: would create circular reference')
    return
  }
  
  // Submit
  await mutation.mutateAsync(data)
}
```

### 2. Handle Loading States
```typescript
const { data, isLoading, isError } = useMenus()

if (isLoading) return <CircularProgress />
if (isError) return <Alert severity="error">Failed to load</Alert>
```

### 3. Provide User Feedback
```typescript
const [successMessage, setSuccessMessage] = useState<string | null>(null)

await mutation.mutateAsync(data)
setSuccessMessage('Item created successfully')
setTimeout(() => setSuccessMessage(null), 3000)
```

### 4. Use Query Invalidation
React Query hooks automatically invalidate related queries:

```typescript
// After creating a menu item:
// ✅ Invalidates menu items list
// ✅ Invalidates menu with items
// ✅ Invalidates menus list (for item count)
```

### 5. Prevent System Menu Deletion
```typescript
const SYSTEM_MENU_SLUGS = ['main', 'footer', 'mobile_drawer']

const handleDelete = (menu: Menu) => {
  if (SYSTEM_MENU_SLUGS.includes(menu.slug)) {
    setError('Cannot delete system menu')
    return
  }
  // Proceed with deletion
}
```

## TypeScript Types

All types are exported and fully typed:

```typescript
import type {
  Menu,
  MenuListItem,
  MenuWithItems,
  MenuItem,
  MenuItemWithMedia,
  MenuItemTreeNode,
  LinkType,
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  BulkReorderMenuItemsDto,
  ListMenusParams,
  ListMenuItemsParams,
} from '@/features/navigation'
```

## Error Handling

Handle API errors gracefully:

```typescript
try {
  await mutation.mutateAsync(data)
} catch (err: any) {
  const message = err?.response?.data?.message || 'Operation failed'
  setErrorMessage(message)
}
```

Common error messages:
- "Menu not found"
- "Slug already exists"
- "Cannot set parent: would create circular reference"
- "Cannot delete system menu"
- "Invalid URL format"
- "Reference ID is required"

## Accessibility

- Keyboard navigation with arrow keys (drag-and-drop)
- ARIA labels on interactive elements
- Focus management in dialogs
- Color contrast meets WCAG standards
- Screen reader friendly tree structure

## Performance Tips

1. **Memoize Flat Items**: Use `useMemo` for `buildFlatListFromTree`
2. **Debounce Search**: Use debounce for search inputs
3. **Lazy Load Images**: Use lazy loading for menu item images
4. **Virtual Scrolling**: Consider virtualizing for 100+ items
5. **Optimistic Updates**: Enable for instant UI feedback

## Testing

### Unit Tests
```typescript
import { validateMenuItem, wouldCreateCycle } from '@/features/navigation'

test('validates URL link type', () => {
  expect(validateMenuItem('url', null, null)).toBe('URL is required')
  expect(validateMenuItem('url', 'https://example.com', null)).toBeNull()
})

test('detects circular reference', () => {
  expect(wouldCreateCycle(1, 1, tree)).toBe(true)
})
```

### Integration Tests
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { MenusListPage } from '@/features/navigation'

test('displays menus list', async () => {
  render(<MenusListPage />)
  await waitFor(() => {
    expect(screen.getByText('Main Navigation')).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Drag-and-drop not working
- Verify @dnd-kit packages are installed
- Check flatItems array is generated correctly
- Ensure unique IDs in SortableContext

### Items not saving
- Check network tab for API errors
- Verify authentication token is valid
- Check validation errors in form

### Tree not updating after changes
- React Query should auto-invalidate
- Check query keys are correct
- Force refetch if needed: `refetch()`

### Parent selection shows wrong items
- Verify getSubtreeIds excludes descendants
- Check wouldCreateCycle logic
- Ensure flatParentOptions is filtered correctly

---

**Module Version**: 1.0.0  
**Last Updated**: 2026-09-10  
**Dependencies**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
