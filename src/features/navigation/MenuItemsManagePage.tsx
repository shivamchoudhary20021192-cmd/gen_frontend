/**
 * MenuItemsManagePage - Manage menu items with drag-and-drop tree
 * Full CRUD operations on menu items with hierarchical tree view and reordering
 */

import { useState, useMemo } from 'react'
import { LinkTargetPicker, isSearchableLinkType } from '../../components/LinkTargetPicker'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Typography,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem as MuiMenuItem,
  FormControlLabel,
  Switch,
  Breadcrumbs,
  Link,
  Stack,
  Divider,
  Tooltip,
  Paper,
} from '@mui/material'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Link as LinkIcon,
  Image as ImageIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useMenu,
  useMenuWithItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useBulkReorderMenuItems,
  type MenuItemTreeNode,
  type CreateMenuItemDto,
  type UpdateMenuItemDto,
  type LinkType,
  LINK_TYPE_OPTIONS,
  getLinkTypeLabel,
  validateMenuItemLabel,
  validateMenuItem,
  buildFlatListFromTree,
  getIndentationStyle,
  getBadgeColor,
  wouldCreateCycle,
  getSubtreeIds,
} from './index'
import { tokens } from '../../theme'

// ══════════════════════════════════════════════════════════════════════════════
// SORTABLE TREE ITEM COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface SortableTreeItemProps {
  item: MenuItemTreeNode
  level: number
  onEdit: (item: MenuItemTreeNode) => void
  onDelete: (item: MenuItemTreeNode) => void
  onToggle: (id: number) => void
  expanded: Set<number>
}

function SortableTreeItem({ item, level, onEdit, onDelete, onToggle, expanded }: SortableTreeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expanded.has(item.id)

  return (
    <>
      <Paper
        ref={setNodeRef}
        style={style}
        sx={{
          mb: 1,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          ...getIndentationStyle(level),
          cursor: isDragging ? 'grabbing' : 'default',
          bgcolor: isDragging ? tokens.ivory : 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: 1,
          },
        }}
      >
        {/* Drag Handle */}
        <Box {...listeners} {...attributes} sx={{ cursor: 'grab', display: 'flex', color: 'text.secondary' }}>
          <DragIcon />
        </Box>

        {/* Expand/Collapse */}
        {hasChildren ? (
          <IconButton size="small" onClick={() => onToggle(item.id)}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
        ) : (
          <Box sx={{ width: 40 }} />
        )}

        {/* Icon Preview */}
        {item.icon_url && (
          <Box
            component="img"
            src={item.icon_url}
            alt=""
            sx={{ width: 20, height: 20, objectFit: 'contain' }}
          />
        )}

        {/* Label */}
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
          {item.label}
        </Typography>

        {/* Link Type */}
        <Chip label={getLinkTypeLabel(item.link_type)} size="small" variant="outlined" />

        {/* Badge */}
        {item.badge_label && (
          <Chip
            label={item.badge_label}
            size="small"
            sx={{
              bgcolor: getBadgeColor(item.badge_label),
              color: 'white',
            }}
          />
        )}

        {/* Active Status */}
        <Tooltip title={item.is_active ? 'Active' : 'Inactive'}>
          <Box sx={{ display: 'flex', color: item.is_active ? 'success.main' : 'text.disabled' }}>
            {item.is_active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          </Box>
        </Tooltip>

        {/* Opens New Tab */}
        {item.opens_new_tab && (
          <Tooltip title="Opens in new tab">
            <LinkIcon fontSize="small" color="primary" />
          </Tooltip>
        )}

        {/* Image Preview */}
        {item.image_url && (
          <Tooltip title="Has mega-menu image">
            <ImageIcon fontSize="small" color="action" />
          </Tooltip>
        )}

        {/* Actions */}
        <IconButton size="small" onClick={() => onEdit(item)} color="primary">
          <EditIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={() => onDelete(item)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Paper>

      {/* Children */}
      {hasChildren && isExpanded && (
        <Box>
          {item.children.map((child) => (
            <SortableTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              expanded={expanded}
            />
          ))}
        </Box>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function MenuItemsManagePage() {
  const navigate = useNavigate()
  const params = useParams<{ menuId?: string; id?: string }>()
  // Support both route parameter names for backward compatibility
  const menuIdNum = Number(params.menuId || params.id)

  // ── State ──────────────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItemTreeNode | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    label: '',
    link_type: 'url' as LinkType,
    url: '',
    link_ref_id: null as number | null,
    parent_id: null as number | null,
    badge_label: '',
    description: '',
    icon_media_id: null as number | null,
    image_media_id: null as number | null,
    opens_new_tab: false,
    is_active: true,
  })
  const [formErrors, setFormErrors] = useState({
    label: '',
    url: '',
    link: '',
  })

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: menu, isLoading: menuLoading } = useMenu(menuIdNum)
  const { data: menuWithItems, isLoading: itemsLoading } = useMenuWithItems(menuIdNum)

  const items = menuWithItems?.items || []

  // Flatten tree for drag-and-drop
  const flatItems = useMemo(() => {
    return buildFlatListFromTree(items)
  }, [items])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateMenuItem()
  const updateMutation = useUpdateMenuItem()
  const deleteMutation = useDeleteMenuItem()
  const bulkReorderMutation = useBulkReorderMenuItems()

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = flatItems.findIndex((item) => item.id === active.id)
    const newIndex = flatItems.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(flatItems, oldIndex, newIndex)

    // Build updates array
    const updates = reordered.map((item, index) => ({
      id: item.id,
      parent_id: item.parent_id,
      sort_order: index * 10,
    }))

    try {
      await bulkReorderMutation.mutateAsync({ updates })
      setSuccessMessage('Menu items reordered successfully')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to reorder items')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    const allIds = new Set<number>()
    function collectIds(nodes: MenuItemTreeNode[]) {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allIds.add(node.id)
          collectIds(node.children)
        }
      })
    }
    collectIds(items)
    setExpanded(allIds)
  }

  const handleCollapseAll = () => {
    setExpanded(new Set())
  }

  const handleOpenCreateDialog = (parentId: number | null = null) => {
    setFormData({
      label: '',
      link_type: 'url',
      url: '',
      link_ref_id: null,
      parent_id: parentId,
      badge_label: '',
      description: '',
      icon_media_id: null,
      image_media_id: null,
      opens_new_tab: false,
      is_active: true,
    })
    setFormErrors({ label: '', url: '', link: '' })
    setCreateDialogOpen(true)
  }

  const handleOpenEditDialog = (item: MenuItemTreeNode) => {
    setSelectedItem(item)
    setFormData({
      label: item.label,
      link_type: item.link_type,
      url: item.url || '',
      link_ref_id: item.link_ref_id,
      parent_id: item.parent_id,
      badge_label: item.badge_label || '',
      description: item.description || '',
      icon_media_id: item.icon_media_id,
      image_media_id: item.image_media_id,
      opens_new_tab: item.opens_new_tab,
      is_active: item.is_active,
    })
    setFormErrors({ label: '', url: '', link: '' })
    setEditDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errors = {
      label: validateMenuItemLabel(formData.label) || '',
      url: '',
      link: '',
    }

    const linkError = validateMenuItem(
      formData.link_type,
      formData.url || null,
      formData.link_ref_id
    )
    if (linkError) {
      if (formData.link_type === 'url') {
        errors.url = linkError
      } else {
        errors.link = linkError
      }
    }

    setFormErrors(errors)
    return !errors.label && !errors.url && !errors.link
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    try {
      const dto: CreateMenuItemDto = {
        menu_id: menuIdNum,
        label: formData.label,
        link_type: formData.link_type,
        url: formData.url || undefined,
        link_ref_id: formData.link_ref_id || undefined,
        parent_id: formData.parent_id || undefined,
        badge_label: formData.badge_label || undefined,
        description: formData.description || undefined,
        icon_media_id: formData.icon_media_id || undefined,
        image_media_id: formData.image_media_id || undefined,
        opens_new_tab: formData.opens_new_tab,
        is_active: formData.is_active,
      }

      await createMutation.mutateAsync(dto)
      setSuccessMessage('Menu item created successfully')
      setCreateDialogOpen(false)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create menu item')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleUpdate = async () => {
    if (!selectedItem || !validateForm()) return

    // Check for circular reference
    if (formData.parent_id && wouldCreateCycle(selectedItem.id, formData.parent_id, items)) {
      setErrorMessage('Cannot set parent: would create circular reference')
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    try {
      const dto: UpdateMenuItemDto = {
        label: formData.label,
        link_type: formData.link_type,
        url: formData.url || null,
        link_ref_id: formData.link_ref_id || null,
        parent_id: formData.parent_id || null,
        badge_label: formData.badge_label || null,
        description: formData.description || null,
        icon_media_id: formData.icon_media_id || null,
        image_media_id: formData.image_media_id || null,
        opens_new_tab: formData.opens_new_tab,
        is_active: formData.is_active,
      }

      await updateMutation.mutateAsync({ id: selectedItem.id, data: dto })
      setSuccessMessage('Menu item updated successfully')
      setEditDialogOpen(false)
      setSelectedItem(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to update menu item')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleDelete = async (item: MenuItemTreeNode) => {
    const childCount = item.children?.length || 0
    const confirmMessage =
      childCount > 0
        ? `Delete "${item.label}" and all ${childCount} child items?`
        : `Delete "${item.label}"?`

    if (!window.confirm(confirmMessage)) return

    try {
      await deleteMutation.mutateAsync(item.id)
      setSuccessMessage('Menu item deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to delete menu item')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  // Get available parent options (exclude self and descendants)
  const getParentOptions = (): MenuItemTreeNode[] => {
    if (!selectedItem) return items

    const excludeIds = getSubtreeIds(selectedItem)
    
    function filterTree(nodes: MenuItemTreeNode[]): MenuItemTreeNode[] {
      return nodes
        .filter((node) => !excludeIds.includes(node.id))
        .map((node) => ({
          ...node,
          children: node.children ? filterTree(node.children) : [],
        }))
    }

    return filterTree(items)
  }

  const parentOptions = editDialogOpen ? getParentOptions() : items

  // Flatten parent options for select
  const flatParentOptions: Array<{ id: number; label: string; level: number }> = []
  function collectParents(nodes: MenuItemTreeNode[], level: number = 0) {
    nodes.forEach((node) => {
      flatParentOptions.push({ id: node.id, label: node.label, level })
      if (node.children) {
        collectParents(node.children, level + 1)
      }
    })
  }
  collectParents(parentOptions)

  // ── Render ─────────────────────────────────────────────────────────────────
  if (menuLoading || itemsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!menu) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Menu not found</Alert>
      </Box>
    )
  }

  // Determine the base path for navigation (support both old and new routes)
  const menusBasePath = window.location.pathname.includes('/content/menus')
    ? '/content/menus'
    : '/navigation/menus'

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate(menusBasePath)}
            sx={{ cursor: 'pointer' }}
          >
            Navigation Menus
          </Link>
          <Typography variant="body2" color="text.primary">
            {menu.name}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Manage Menu Items
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {menu.name} - Drag items to reorder, nest under parents
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(menusBasePath)}>
              Back
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCreateDialog()}>
              Add Item
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Toolbar */}
      <Card sx={{ mb: 2, p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {flatItems.length} items
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Button size="small" onClick={handleExpandAll}>
            Expand All
          </Button>
          <Button size="small" onClick={handleCollapseAll}>
            Collapse All
          </Button>
        </Stack>
      </Card>

      {/* Tree */}
      {items.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            bgcolor: tokens.ivory,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No menu items yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add your first menu item to get started
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCreateDialog()}>
            Add Item
          </Button>
        </Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={flatItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableTreeItem
                key={item.id}
                item={item}
                level={0}
                onEdit={handleOpenEditDialog}
                onDelete={handleDelete}
                onToggle={handleToggle}
                expanded={expanded}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false)
          setEditDialogOpen(false)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editDialogOpen ? 'Edit Menu Item' : 'Create Menu Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {/* Label */}
            <TextField
              label="Label"
              fullWidth
              required
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              error={!!formErrors.label}
              helperText={formErrors.label || 'Display text for the menu item'}
            />

            {/* Link Type */}
            <FormControl fullWidth required>
              <InputLabel id="menu-item-link-type-label">Link Type</InputLabel>
              <Select
                labelId="menu-item-link-type-label"
                value={formData.link_type}
                onChange={(e) => setFormData({ ...formData, link_type: e.target.value as LinkType })}
                label="Link Type"
              >
                {LINK_TYPE_OPTIONS.map((option) => (
                  <MuiMenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MuiMenuItem>
                ))}
              </Select>
            </FormControl>

            {/* URL (for url type) */}
            {formData.link_type === 'url' && (
              <TextField
                label="URL"
                fullWidth
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                error={!!formErrors.url}
                helperText={formErrors.url || 'Full URL including https://'}
                placeholder="https://example.com"
              />
            )}

            {/* What it points at, by name. The same control as the banner
                form's call to action — one field, one behaviour, wherever a
                link is being built. */}
            {formData.link_type !== 'url' &&
              formData.link_type !== 'none' &&
              isSearchableLinkType(formData.link_type) && (
                <LinkTargetPicker
                  type={formData.link_type}
                  value={formData.link_ref_id}
                  onChange={(id) => setFormData({ ...formData, link_ref_id: id })}
                  error={!!formErrors.link}
                  helperText={formErrors.link || undefined}
                  size="medium"
                />
              )}

            {formData.link_type !== 'url' &&
              formData.link_type !== 'none' &&
              !isSearchableLinkType(formData.link_type) && (
                <TextField
                  label="Reference ID"
                  fullWidth
                  required
                  type="number"
                  value={formData.link_ref_id || ''}
                  onChange={(e) => setFormData({ ...formData, link_ref_id: Number(e.target.value) || null })}
                  error={!!formErrors.link}
                  helperText={formErrors.link || `ID of the ${formData.link_type} to link to`}
                />
              )}

            {/* Parent */}
            <FormControl fullWidth>
              <InputLabel id="menu-item-parent-label">Parent Item</InputLabel>
              <Select
                labelId="menu-item-parent-label"
                value={formData.parent_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_id: (e.target.value as number) || null })}
                label="Parent Item"
              >
                <MuiMenuItem value="">
                  <em>None (Top Level)</em>
                </MuiMenuItem>
                {flatParentOptions.map((option) => (
                  <MuiMenuItem key={option.id} value={option.id}>
                    {'—'.repeat(option.level)} {option.label}
                  </MuiMenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Badge Label */}
            <TextField
              label="Badge Label"
              fullWidth
              value={formData.badge_label}
              onChange={(e) => setFormData({ ...formData, badge_label: e.target.value })}
              helperText='Optional badge text (e.g., "New", "Sale")'
            />

            {/* Description */}
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              helperText="Optional description for mega-menus"
            />

            {/* Icon Media ID */}
            <TextField
              label="Icon Media ID"
              fullWidth
              type="number"
              value={formData.icon_media_id || ''}
              onChange={(e) => setFormData({ ...formData, icon_media_id: Number(e.target.value) || null })}
              helperText="Optional icon image"
            />

            {/* Image Media ID */}
            <TextField
              label="Image Media ID"
              fullWidth
              type="number"
              value={formData.image_media_id || ''}
              onChange={(e) => setFormData({ ...formData, image_media_id: Number(e.target.value) || null })}
              helperText="Optional large image for mega-menus"
            />

            {/* Switches */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.opens_new_tab}
                  onChange={(e) => setFormData({ ...formData, opens_new_tab: e.target.checked })}
                />
              }
              label="Opens in New Tab"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setCreateDialogOpen(false)
              setEditDialogOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editDialogOpen ? handleUpdate : handleCreate}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editDialogOpen
              ? updateMutation.isPending
                ? 'Saving...'
                : 'Save Changes'
              : createMutation.isPending
              ? 'Creating...'
              : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

