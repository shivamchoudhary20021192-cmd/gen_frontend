import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import ShieldIcon from '@mui/icons-material/Shield'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
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
import { useNavigate } from 'react-router-dom'
import type { AdminUser } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatRelative } from '../../lib/format'
import { useRoles, useStaffList, type StaffStatus } from './useStaff'

const STATUS_COLOR: Record<StaffStatus, 'success' | 'info' | 'warning' | 'default'> = {
  active: 'success',
  invited: 'info',
  suspended: 'warning',
  disabled: 'default',
}

const STATUS_LABEL: Record<StaffStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  disabled: 'Disabled',
}

function initials(admin: AdminUser): string {
  const first = admin.first_name?.[0] ?? ''
  const last = admin.last_name?.[0] ?? ''
  return (first + last || admin.email[0]).toUpperCase()
}

export function StaffPage() {
  const navigate = useNavigate()
  const { can, admin: me } = useAuth()
  const canManage = can('admins.create')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [roleId, setRoleId] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      q: search || undefined,
      status: status || undefined,
      role_id: roleId || undefined,
      sort: 'created_at:desc',
    }),
    [search, status, roleId],
  )

  const list = useStaffList(params)
  const roles = useRoles()
  const staff = list.data?.admin_users ?? []

  return (
    <Box>
      <PageHeader
        title="Staff"
        subtitle={list.data ? `${list.data.pagination.total} accounts` : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ShieldIcon />} onClick={() => navigate('/settings/roles')}>
              Roles
            </Button>
            {canManage && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/settings/staff/new')}>
                Add staff
              </Button>
            )}
          </Stack>
        }
      />

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name or email"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="invited">Invited</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </TextField>
          <TextField
            select
            label="Role"
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All roles</MenuItem>
            {(roles.data?.roles ?? []).map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : list.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load staff accounts.
          </Alert>
        ) : staff.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              {search || status || roleId ? 'No accounts match these filters.' : 'No staff accounts yet.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last signed in</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map((person) => (
                  <TableRow
                    key={person.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/settings/staff/${person.id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>{initials(person)}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {person.first_name} {person.last_name ?? ''}
                            </Typography>
                            {person.id === me?.id && (
                              <Chip label="You" size="small" sx={{ height: 17, fontSize: 10 }} />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {person.email}
                            {person.job_title && ` · ${person.job_title}`}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {person.is_super_admin ? (
                        <Tooltip title="Bypasses every permission check">
                          <Chip
                            size="small"
                            icon={<ShieldIcon sx={{ fontSize: 14 }} />}
                            label="Super admin"
                            color="primary"
                          />
                        </Tooltip>
                      ) : (person.roles ?? []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          No roles — can sign in, can do nothing
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {(person.roles ?? []).map((role) => (
                            <Chip key={role.id} label={role.name} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={STATUS_LABEL[person.status]}
                        color={STATUS_COLOR[person.status]}
                        variant={person.status === 'active' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {person.last_login_at ? formatRelative(person.last_login_at) : 'Never'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  )
}
