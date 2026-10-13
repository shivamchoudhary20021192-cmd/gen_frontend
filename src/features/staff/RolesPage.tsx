import AddIcon from '@mui/icons-material/Add'
import LockIcon from '@mui/icons-material/Lock'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Snackbar,
  Stack,
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
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import {
  useCreateRole,
  useDeleteRole,
  usePermissions,
  useRole,
  useRoles,
  useUpdateRole,
  type Permission,
  type Role,
} from './useStaff'

/** Module keys are slugs; these read better in a heading. */
const MODULE_LABELS: Record<string, string> = {
  admins: 'Staff & access',
  roles: 'Roles',
  products: 'Products',
  inventory: 'Inventory',
  media: 'Media',
  orders: 'Orders',
  customers: 'Customers',
  coupons: 'Discounts',
  content: 'Content',
  reviews: 'Reviews',
  support: 'Support',
  reports: 'Reports',
  settings: 'Settings',
}

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export function RolesPage() {
  const { can } = useAuth()
  const canManage = can('roles.manage')

  const roles = useRoles()
  const permissions = usePermissions()
  const remove = useDeleteRole()

  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const totalPermissions = permissions.data?.total ?? 0

  return (
    <Box>
      <PageHeader
        title="Roles & permissions"
        subtitle={`${roles.data?.roles.length ?? 0} roles · ${totalPermissions} permissions`}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditingId('new')}>
              Create role
            </Button>
          ) : null
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        A role is a named bundle of permissions. Staff accounts get roles, not individual
        permissions — so "what can Content do?" has one answer, in one place.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        {roles.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : roles.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load roles.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell align="right">Permissions</TableCell>
                  <TableCell align="right">Staff</TableCell>
                  <TableCell align="right" sx={{ width: 90 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {(roles.data?.roles ?? []).map((role) => (
                  <TableRow
                    key={role.id}
                    hover
                    sx={{ cursor: canManage ? 'pointer' : 'default' }}
                    onClick={() => canManage && setEditingId(role.id)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {role.name}
                        </Typography>
                        {role.is_system && (
                          <Tooltip title="Built in — editable, but cannot be deleted">
                            <LockIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {role.description ?? role.slug}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{role.permission_count}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{role.admin_count}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                      {canManage && !role.is_system && (
                        <Button
                          size="small"
                          color="error"
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(role.id, {
                              onSuccess: () => setToast('Role deleted'),
                              onError: (caught) =>
                                setError(
                                  caught instanceof ApiError ? caught.message : 'Could not delete the role.',
                                ),
                            })
                          }
                        >
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {editingId !== null && (
        <RoleDialog
          roleId={editingId}
          permissionsByModule={permissions.data?.permissions ?? {}}
          onClose={() => setEditingId(null)}
          onSaved={(message) => {
            setEditingId(null)
            setToast(message)
          }}
          onError={setError}
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

function RoleDialog({
  roleId,
  permissionsByModule,
  onClose,
  onSaved,
  onError,
}: {
  roleId: number | 'new'
  permissionsByModule: Record<string, Permission[]>
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const isNew = roleId === 'new'
  const detail = useRole(isNew ? undefined : roleId)
  const create = useCreateRole()
  const update = useUpdateRole(isNew ? 0 : roleId)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<number[]>([])

  const role: Role | undefined = detail.data?.role

  useEffect(() => {
    if (!role) return
    setName(role.name)
    setSlug(role.slug)
    setSlugTouched(true)
    setDescription(role.description ?? '')
    setSelected((role.permissions ?? []).map((permission) => permission.id))
  }, [role])

  // A slug is a stable handle; deriving it from the name is a convenience for
  // new roles only. Renaming an existing role must not silently change its slug.
  useEffect(() => {
    if (isNew && !slugTouched) setSlug(slugify(name))
  }, [name, isNew, slugTouched])

  const modules = useMemo(() => Object.keys(permissionsByModule).sort(), [permissionsByModule])

  const toggle = (id: number, on: boolean) => {
    setSelected((current) => (on ? [...current, id] : current.filter((value) => value !== id)))
  }

  const toggleModule = (module: string, on: boolean) => {
    const ids = (permissionsByModule[module] ?? []).map((permission) => permission.id)
    setSelected((current) =>
      on ? [...new Set([...current, ...ids])] : current.filter((value) => !ids.includes(value)),
    )
  }

  const save = () => {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      permission_ids: selected,
      ...(isNew ? { slug: slug.trim() } : {}),
    }
    const onErrorHandler = (caught: unknown) =>
      onError(caught instanceof ApiError ? caught.message : 'Could not save the role.')

    if (isNew) {
      create.mutate(payload, {
        onSuccess: () => onSaved('Role created'),
        onError: onErrorHandler,
      })
    } else {
      update.mutate(payload, {
        onSuccess: () => onSaved('Role saved'),
        onError: onErrorHandler,
      })
    }
  }

  const busy = create.isPending || update.isPending
  const loading = !isNew && detail.isLoading

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {isNew ? 'Create role' : role?.name ?? 'Role'}
        {role?.is_system && (
          <Chip label="System role" size="small" sx={{ ml: 1, height: 19 }} variant="outlined" />
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Name"
                placeholder="Content editor"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Slug"
                placeholder="content-editor"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
                disabled={!isNew}
                sx={{ flex: 1 }}
                helperText={isNew ? 'Lowercase, hyphens allowed.' : 'Fixed after creation.'}
              />
            </Stack>
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Writes product copy and manages the journal"
              fullWidth
            />

            <Divider />

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2">Permissions</Typography>
              <Chip label={`${selected.length} selected`} size="small" sx={{ height: 19 }} />
            </Stack>

            {modules.map((module) => {
              const items = permissionsByModule[module] ?? []
              const chosen = items.filter((permission) => selected.includes(permission.id)).length
              const all = chosen === items.length && items.length > 0
              return (
                <Box key={module}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={all}
                        indeterminate={chosen > 0 && !all}
                        // Without this the accessible name reads "Products 3/7",
                        // which is a progress report, not a control name.
                        slotProps={{ input: { 'aria-label': `All ${moduleLabel(module)} permissions` } }}
                        onChange={(event) => toggleModule(module, event.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {moduleLabel(module)}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {chosen}/{items.length}
                        </Typography>
                      </Typography>
                    }
                  />
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      pl: 3.5,
                    }}
                  >
                    {items.map((permission) => (
                      <FormControlLabel
                        key={permission.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={selected.includes(permission.id)}
                            onChange={(event) => toggle(permission.id, event.target.checked)}
                          />
                        }
                        label={
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <Typography variant="caption">{permission.name}</Typography>
                            {permission.is_dangerous && (
                              <Tooltip title="Destructive or sensitive — grant sparingly">
                                <WarningAmberIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                              </Tooltip>
                            )}
                          </Stack>
                        }
                      />
                    ))}
                  </Box>
                </Box>
              )
            })}

            {selected.length === 0 && (
              <Alert severity="warning">
                A role with no permissions lets someone sign in and see nothing. That is allowed, but
                it is rarely what you meant.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={busy || name.trim().length < 2}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
