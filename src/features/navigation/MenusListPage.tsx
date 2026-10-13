/**
 * MenusListPage - Display available menus for management
 * Shows list of menus (main, footer, mobile_drawer, etc.) with navigation to manage items
 */

import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Grid,
  Typography,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import {
  useMenus,
  useCreateMenu,
  useUpdateMenu,
  useDeleteMenu,
  type MenuListItem,
  type CreateMenuDto,
  type UpdateMenuDto,
  generateSlug,
  validateMenuName,
  validateSlug,
} from './index'
import { tokens } from '../../theme'

export function MenusListPage() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ element: HTMLElement; menu: MenuListItem } | null>(
    null
  )
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMenu, setSelectedMenu] = useState<MenuListItem | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    is_active: true,
  })
  const [formErrors, setFormErrors] = useState({
    name: '',
    slug: '',
  })

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: menusData, isLoading, isError } = useMenus()
  const menus = menusData?.data || []

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateMenu()
  const updateMutation = useUpdateMenu()
  const deleteMutation = useDeleteMenu()

  // ── System Menus ───────────────────────────────────────────────────────────
  const SYSTEM_MENU_SLUGS = ['main', 'footer', 'mobile_drawer', 'footer_shop', 'footer_support']

  const isSystemMenu = (slug: string) => SYSTEM_MENU_SLUGS.includes(slug)

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleManageItems = (menu: MenuListItem) => {
    // Use the current path base to maintain route compatibility
    const basePath = window.location.pathname.includes('/content/menus') 
      ? '/content/menus' 
      : '/navigation/menus'
    navigate(`${basePath}/${menu.id}/items`)
  }

  const handleOpenCreateDialog = () => {
    setFormData({ name: '', slug: '', is_active: true })
    setFormErrors({ name: '', slug: '' })
    setCreateDialogOpen(true)
  }

  const handleOpenEditDialog = (menu: MenuListItem) => {
    setSelectedMenu(menu)
    setFormData({
      name: menu.name,
      slug: menu.slug,
      is_active: menu.is_active,
    })
    setFormErrors({ name: '', slug: '' })
    setEditDialogOpen(true)
    setActionMenuAnchor(null)
  }

  const validateForm = (): boolean => {
    const errors = {
      name: validateMenuName(formData.name) || '',
      slug: validateSlug(formData.slug) || '',
    }

    setFormErrors(errors)
    return !errors.name && !errors.slug
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    try {
      const dto: CreateMenuDto = {
        name: formData.name,
        slug: formData.slug || undefined,
        is_active: formData.is_active,
      }

      await createMutation.mutateAsync(dto)
      setSuccessMessage('Menu created successfully')
      setCreateDialogOpen(false)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create menu')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleUpdate = async () => {
    if (!selectedMenu || !validateForm()) return

    try {
      const dto: UpdateMenuDto = {
        name: formData.name,
        slug: formData.slug,
        is_active: formData.is_active,
      }

      await updateMutation.mutateAsync({ id: selectedMenu.id, data: dto })
      setSuccessMessage('Menu updated successfully')
      setEditDialogOpen(false)
      setSelectedMenu(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to update menu')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleDelete = async (menu: MenuListItem) => {
    if (isSystemMenu(menu.slug)) {
      setErrorMessage('System menus cannot be deleted')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    if (!window.confirm(`Are you sure you want to delete "${menu.name}"? This will also delete all menu items.`)) {
      return
    }

    try {
      await deleteMutation.mutateAsync(menu.id)
      setSuccessMessage('Menu deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to delete menu')
      setTimeout(() => setErrorMessage(null), 5000)
    }
    setActionMenuAnchor(null)
  }

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Navigation Menus
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your storefront navigation menus and menu items
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
          sx={{ borderRadius: 2 }}
        >
          Create Menu
        </Button>
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

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load menus. Please try again.
        </Alert>
      )}

      {/* Menus Grid */}
      {!isLoading && !isError && (
        <Grid container spacing={3}>
          {menus.map((menu) => (
            <Grid key={menu.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MenuIcon color="primary" />
                      <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                        {menu.name}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => setActionMenuAnchor({ element: e.currentTarget, menu })}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      fontFamily: 'monospace',
                      bgcolor: tokens.ivory,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      display: 'inline-block',
                    }}
                  >
                    {menu.slug}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={menu.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={menu.is_active ? 'success' : 'default'}
                    />
                    {isSystemMenu(menu.slug) && (
                      <Chip label="System" size="small" color="primary" variant="outlined" />
                    )}
                    <Chip
                      label={`${menu.item_count} items`}
                      size="small"
                      variant="outlined"
                      icon={<MenuIcon fontSize="small" />}
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Last updated: {new Date(menu.updated_at).toLocaleDateString()}
                  </Typography>
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SettingsIcon />}
                    onClick={() => handleManageItems(menu)}
                    sx={{ borderRadius: 1.5 }}
                  >
                    Manage Items
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}

          {menus.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  bgcolor: tokens.ivory,
                  borderRadius: 2,
                }}
              >
                <MenuIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No menus found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first navigation menu to get started
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
                  Create Menu
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor?.element}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => actionMenuAnchor && handleOpenEditDialog(actionMenuAnchor.menu)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Menu
        </MenuItem>
        <MenuItem
          onClick={() => actionMenuAnchor && handleDelete(actionMenuAnchor.menu)}
          disabled={Boolean(actionMenuAnchor && isSystemMenu(actionMenuAnchor.menu.slug))}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Menu
        </MenuItem>
      </Menu>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Menu</DialogTitle>
        <DialogContent>
          <TextField
            label="Menu Name"
            fullWidth
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            error={!!formErrors.name}
            helperText={formErrors.name || 'e.g., "Main Navigation", "Footer Menu"'}
            sx={{ mt: 2, mb: 2 }}
          />

          <TextField
            label="Slug"
            fullWidth
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            error={!!formErrors.slug}
            helperText={formErrors.slug || 'Auto-generated from name. Use lowercase, hyphens only.'}
            sx={{ mb: 2 }}
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Menu</DialogTitle>
        <DialogContent>
          <TextField
            label="Menu Name"
            fullWidth
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            error={!!formErrors.name}
            helperText={formErrors.name}
            sx={{ mt: 2, mb: 2 }}
          />

          <TextField
            label="Slug"
            fullWidth
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            error={!!formErrors.slug}
            helperText={formErrors.slug}
            disabled={selectedMenu ? isSystemMenu(selectedMenu.slug) : false}
            sx={{ mb: 2 }}
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

