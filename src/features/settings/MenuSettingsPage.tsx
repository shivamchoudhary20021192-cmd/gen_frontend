import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import LockIcon from '@mui/icons-material/Lock'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { AVAILABLE_ICON_NAMES, menuIcon } from '../../navigation/icons'
import { isImplemented } from '../../navigation/routeRegistry'
import { useMenuItems, type MenuItemAdmin } from '../../navigation/useNavigation'
import {
  usePermissionOptions,
  useReorderMenuItems,
  useUpdateMenuItem,
  type MenuItemPatch,
} from './useMenuAdmin'

const STATUS_LABEL: Record<MenuItemAdmin['status'], string> = {
  available: 'Available',
  coming_soon: 'Coming soon',
  hidden: 'Hidden',
}

const STATUS_COLOR: Record<MenuItemAdmin['status'], 'success' | 'info' | 'default'> = {
  available: 'success',
  coming_soon: 'info',
  hidden: 'default',
}

interface Row extends MenuItemAdmin {
  depth: number
  /** Index among its siblings — reorder only ever moves within one parent. */
  siblingIndex: number
  siblingCount: number
}

/** Flatten the tree into render order so one table can show the whole menu. */
function flatten(items: MenuItemAdmin[]): Row[] {
  const byParent = new Map<number | null, MenuItemAdmin[]>()
  for (const item of items) {
    const list = byParent.get(item.parent_id) ?? []
    list.push(item)
    byParent.set(item.parent_id, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
  }

  const out: Row[] = []
  const walk = (parentId: number | null, depth: number) => {
    const siblings = byParent.get(parentId) ?? []
    siblings.forEach((item, index) => {
      out.push({ ...item, depth, siblingIndex: index, siblingCount: siblings.length })
      walk(item.id, depth + 1)
    })
  }
  walk(null, 0)
  return out
}

export function MenuSettingsPage() {
  const { isSuperAdmin } = useAuth()

  const items = useMenuItems(isSuperAdmin)
  const permissions = usePermissionOptions(isSuperAdmin)
  const update = useUpdateMenuItem()
  const reorder = useReorderMenuItems()

  const [editing, setEditing] = useState<Row | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => flatten(items.data?.menu_items ?? []), [items.data])

  const permissionSlugs = useMemo(() => {
    const groups = permissions.data?.permissions ?? {}
    return Object.values(groups)
      .flat()
      .map((permission) => permission.slug)
      .sort()
  }, [permissions.data])

  if (!isSuperAdmin) {
    return (
      <Box>
        <PageHeader title="Navigation" />
        <Alert severity="warning">Only a super admin can edit the navigation menu.</Alert>
      </Box>
    )
  }

  const move = (row: Row, direction: -1 | 1) => {
    const siblings = rows.filter((candidate) => candidate.parent_id === row.parent_id)
    const target = siblings[row.siblingIndex + direction]
    if (!target) return
    setError(null)
    reorder.mutate(
      [
        { id: row.id, sort_order: target.sort_order },
        { id: target.id, sort_order: row.sort_order },
      ],
      {
        onError: (caught) =>
          setError(caught instanceof ApiError ? caught.message : 'Could not reorder the menu.'),
        onSuccess: () => setToast('Menu order updated'),
      },
    )
  }

  const save = (patch: MenuItemPatch) => {
    if (!editing) return
    setError(null)
    update.mutate(
      { id: editing.id, patch },
      {
        onError: (caught) =>
          setError(caught instanceof ApiError ? caught.message : 'Could not save the menu item.'),
        onSuccess: () => {
          setEditing(null)
          setToast('Menu item saved')
        },
      },
    )
  }

  return (
    <Box>
      <PageHeader
        title="Navigation"
        subtitle={`${rows.length} menu items · the sidebar every admin sees is built from this table`}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Hiding an item only removes the link. It does not protect the endpoint behind it — permissions
        do that. An item with no permissions attached is visible to every signed-in admin.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        {items.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : items.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load the menu.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 260 }}>Item</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" sx={{ width: 108 }}>
                    Order
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const Icon = menuIcon(row.icon)
                  const missingScreen = row.status === 'available' && Boolean(row.route) && !isImplemented(row.key)
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: 'pointer', opacity: row.is_active ? 1 : 0.5 }}
                      onClick={() => setEditing(row)}
                    >
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', pl: row.depth * 3 }}
                        >
                          <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: row.depth === 0 ? 600 : 400 }}>
                                {row.title}
                              </Typography>
                              {row.requires_super_admin && (
                                <Tooltip title="Super admins only">
                                  <LockIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                </Tooltip>
                              )}
                              {missingScreen && (
                                <Tooltip title="Marked available, but this build has no screen for it — it renders disabled.">
                                  <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                </Tooltip>
                              )}
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              {row.key}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {row.route ?? '— group —'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {row.section ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.permissions.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            Everyone
                          </Typography>
                        ) : (
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {row.permissions.slice(0, 2).map((slug) => (
                              <Chip key={slug} label={slug} size="small" variant="outlined" sx={{ height: 19 }} />
                            ))}
                            {row.permissions.length > 2 && (
                              <Chip
                                label={`+${row.permissions.length - 2}`}
                                size="small"
                                sx={{ height: 19 }}
                              />
                            )}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[row.status]}
                          color={STATUS_COLOR[row.status]}
                          variant={row.status === 'available' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        <IconButton
                          size="small"
                          aria-label={`Move ${row.title} up`}
                          disabled={row.siblingIndex === 0 || reorder.isPending}
                          onClick={() => move(row, -1)}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Move ${row.title} down`}
                          disabled={row.siblingIndex === row.siblingCount - 1 || reorder.isPending}
                          onClick={() => move(row, 1)}
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {editing && (
        <EditDialog
          key={editing.id}
          row={editing}
          permissionSlugs={permissionSlugs}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

function EditDialog({
  row,
  permissionSlugs,
  saving,
  onClose,
  onSave,
}: {
  row: Row
  permissionSlugs: string[]
  saving: boolean
  onClose: () => void
  onSave: (patch: MenuItemPatch) => void
}) {
  const [title, setTitle] = useState(row.title)
  const [subtitle, setSubtitle] = useState(row.subtitle ?? '')
  const [icon, setIcon] = useState(row.icon ?? '')
  const [section, setSection] = useState(row.section ?? '')
  const [status, setStatus] = useState<MenuItemAdmin['status']>(row.status)
  const [isActive, setIsActive] = useState(row.is_active)
  const [slugs, setSlugs] = useState<string[]>(row.permissions)

  const Icon = menuIcon(icon || null)
  const buildMissing = status === 'available' && Boolean(row.route) && !isImplemented(row.key)

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Icon sx={{ fontSize: 20 }} />
          <span>{row.title}</span>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {row.key}
          {row.route ? ` · ${row.route}` : ' · group header'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Title"
            placeholder="Products"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Subtitle"
            placeholder="Catalogue, categories and collections"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            helperText="Optional one-liner shown under the title in wide layouts."
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Autocomplete
              options={AVAILABLE_ICON_NAMES}
              value={icon || null}
              onChange={(_, next) => setIcon(next ?? '')}
              sx={{ flex: 1 }}
              renderOption={(props, option) => {
                const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string }
                const OptionIcon = menuIcon(option)
                return (
                  <Box component="li" key={key} {...rest}>
                    <OptionIcon sx={{ fontSize: 17, mr: 1, color: 'text.secondary' }} />
                    {option}
                  </Box>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Icon"
                  placeholder="products"
                  helperText="Logical name, mapped to a component."
                />
              )}
            />
            <TextField
              label="Section"
              placeholder="Commerce"
              value={section}
              onChange={(event) => setSection(event.target.value)}
              sx={{ flex: 1 }}
              helperText="Sidebar group heading. Top-level items only."
            />
          </Stack>

          <Autocomplete
            multiple
            options={permissionSlugs}
            value={slugs}
            onChange={(_, next) => setSlugs(next)}
            renderValue={(value, getItemProps) =>
              value.map((slug, index) => {
                const { key, ...rest } = getItemProps({ index })
                return <Chip key={key} label={slug} size="small" {...rest} />
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Visible to permissions"
                placeholder={slugs.length === 0 ? 'e.g. products.view' : ''}
                helperText={
                  slugs.length === 0
                    ? 'Empty means every signed-in admin sees this item.'
                    : 'An admin holding ANY of these sees the item.'
                }
              />
            )}
          />

          <Divider />

          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as MenuItemAdmin['status'])}
            fullWidth
          >
            <MenuItem value="available">Available — clickable link</MenuItem>
            <MenuItem value="coming_soon">Coming soon — shown, greyed out</MenuItem>
            <MenuItem value="hidden">Hidden — not returned to anyone</MenuItem>
          </TextField>

          {buildMissing && (
            <Alert severity="warning">
              This build has no screen registered for <code>{row.key}</code>. It will still render
              disabled rather than opening a dead route.
            </Alert>
          )}

          <FormControlLabel
            control={<Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
            label="Active"
          />

          {row.is_system && (
            <Typography variant="caption" color="text.secondary">
              System item — it can be renamed, reordered and hidden, but not deleted.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving || title.trim().length === 0}
          onClick={() =>
            onSave({
              title: title.trim(),
              subtitle: subtitle.trim() || null,
              icon: icon.trim() || null,
              section: section.trim() || null,
              status,
              is_active: isActive,
              permission_slugs: slugs,
            })
          }
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
