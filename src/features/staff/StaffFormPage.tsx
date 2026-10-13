import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckIcon from '@mui/icons-material/Check'
import ShieldIcon from '@mui/icons-material/Shield'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatRelative } from '../../lib/format'
import {
  useCreateStaff,
  useDeleteStaff,
  useResetStaffPassword,
  useRoles,
  useSetStaffRoles,
  useStaffAction,
  useStaffMember,
  useStaffPermissions,
  useUpdateStaff,
  type StaffInput,
} from './useStaff'

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC']

/**
 * Mirrors the server's `passwordSchema`.
 *
 * Duplicated deliberately: the server is still the authority and will reject a
 * weak password, but telling someone which rule they missed while they type
 * beats a 422 after they hit Save.
 */
const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (v: string) => v.length >= 10 },
  { label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'A number', test: (v: string) => /[0-9]/.test(v) },
]

interface FormState {
  email: string
  first_name: string
  last_name: string
  phone: string
  job_title: string
  timezone: string
}

const EMPTY: FormState = {
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  job_title: '',
  timezone: 'Asia/Kolkata',
}

export function StaffFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const staffId = isNew ? undefined : Number(id)

  const navigate = useNavigate()
  const { can, isSuperAdmin, admin: me } = useAuth()
  const canManage = can('admins.create', 'admins.update')

  const query = useStaffMember(staffId)
  const effective = useStaffPermissions(staffId)
  const roles = useRoles()
  const create = useCreateStaff()
  const update = useUpdateStaff(staffId ?? 0)
  const setRoles = useSetStaffRoles(staffId ?? 0)
  const accountAction = useStaffAction(staffId ?? 0)
  const resetPassword = useResetStaffPassword(staffId ?? 0)
  const remove = useDeleteStaff()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [roleIds, setRoleIds] = useState<number[]>([])
  const [superAdmin, setSuperAdmin] = useState(false)
  const [accessMode, setAccessMode] = useState<'invite' | 'password'>('invite')
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(true)

  const [resetOpen, setResetOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ severity: 'error' | 'warning'; title: string; body: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const person = query.data?.admin_user
  const isSelf = person?.id === me?.id

  useEffect(() => {
    if (!person) return
    setForm({
      email: person.email,
      first_name: person.first_name,
      last_name: person.last_name ?? '',
      phone: person.phone ?? '',
      job_title: person.job_title ?? '',
      timezone: person.timezone,
    })
    setRoleIds((person.roles ?? []).map((role) => role.id))
    setSuperAdmin(person.is_super_admin)
  }, [person])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const passwordOk = useMemo(() => PASSWORD_RULES.every((rule) => rule.test(password)), [password])

  const handleError = (error: unknown, title: string) => {
    if (error instanceof ApiError) {
      setFieldErrors(error.fieldErrors())
      setBanner({ severity: error.status === 422 ? 'warning' : 'error', title, body: error.message })
    } else {
      setBanner({ severity: 'error', title, body: 'Unexpected error.' })
    }
  }

  const save = async () => {
    setFieldErrors({})
    setBanner(null)

    const base: StaffInput = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      phone: form.phone.trim() || null,
      job_title: form.job_title.trim() || null,
      timezone: form.timezone,
    }

    try {
      if (isNew) {
        const created = await create.mutateAsync({
          ...base,
          role_ids: roleIds,
          is_super_admin: superAdmin,
          // Omitting the password creates an 'invited' account with no way in
          // yet — which is the safer default for a real colleague.
          ...(accessMode === 'password' ? { password, must_change_password: mustChange } : {}),
        })
        navigate(`/settings/staff/${created.admin_user.id}`, { replace: true })
        setToast(
          accessMode === 'password'
            ? 'Account created — they can sign in now'
            : 'Invitation sent',
        )
        return
      }

      // Details and roles are separate endpoints; is_super_admin rides with the
      // details PATCH because the server checks it against the last-super-admin
      // rule there.
      await update.mutateAsync({ ...base, ...(isSuperAdmin ? { is_super_admin: superAdmin } : {}) })
      if (!superAdmin) await setRoles.mutateAsync(roleIds)
      await query.refetch()
      await effective.refetch()
      setToast('Saved')
    } catch (error) {
      handleError(error, isNew ? 'Could not create the account' : 'Could not save changes')
    }
  }

  const runAction = (action: 'suspend' | 'activate') => {
    setBanner(null)
    accountAction.mutate(action, {
      onSuccess: () => {
        setToast(action === 'suspend' ? 'Account suspended' : 'Account reactivated')
        void query.refetch()
      },
      onError: (error) => handleError(error, `Could not ${action} the account`),
    })
  }

  const destroy = () => {
    if (!staffId) return
    remove.mutate(staffId, {
      onSuccess: () => navigate('/settings/staff'),
      onError: (error) => handleError(error, 'Could not delete the account'),
    })
  }

  if (!isNew && query.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  if (!isNew && query.isError) {
    return <Alert severity="error">Could not load this account.</Alert>
  }

  const busy = create.isPending || update.isPending || setRoles.isPending
  const canSubmit =
    form.email.trim().length > 0 &&
    form.first_name.trim().length > 0 &&
    (superAdmin || roleIds.length > 0) &&
    (!isNew || accessMode === 'invite' || passwordOk)

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/settings/staff')}
            sx={{ mb: 1, ml: -1 }}
          >
            Staff
          </Button>
        }
        title={isNew ? 'Add staff' : `${form.first_name} ${form.last_name}`.trim() || 'Staff account'}
        subtitle={isNew ? undefined : `${person?.email} · joined ${formatRelative(person?.created_at ?? '')}`}
        actions={
          canManage ? (
            <Button variant="contained" onClick={save} disabled={busy || !canSubmit}>
              {busy ? 'Saving…' : isNew ? 'Create account' : 'Save'}
            </Button>
          ) : null
        }
      />

      {banner && (
        <Alert severity={banner.severity} sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          <AlertTitle>{banner.title}</AlertTitle>
          {banner.body}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardHeader title="Details" slotProps={{ title: { variant: 'subtitle1' } }} />
              <CardContent sx={{ pt: 0 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="First name"
                      placeholder="Priya"
                      value={form.first_name}
                      onChange={(event) => set('first_name', event.target.value)}
                      error={Boolean(fieldErrors.first_name)}
                      helperText={fieldErrors.first_name}
                      required
                      fullWidth
                      disabled={!canManage}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Last name"
                      placeholder="Sharma"
                      value={form.last_name}
                      onChange={(event) => set('last_name', event.target.value)}
                      fullWidth
                      disabled={!canManage}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Email"
                      placeholder="priya@veylor.com"
                      type="email"
                      value={form.email}
                      onChange={(event) => set('email', event.target.value)}
                      error={Boolean(fieldErrors.email)}
                      helperText={fieldErrors.email ?? 'This is how they sign in.'}
                      required
                      fullWidth
                      disabled={!canManage}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Phone"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(event) => set('phone', event.target.value)}
                      fullWidth
                      disabled={!canManage}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Job title"
                      value={form.job_title}
                      onChange={(event) => set('job_title', event.target.value)}
                      placeholder="Content lead"
                      fullWidth
                      disabled={!canManage}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Timezone"
                      value={form.timezone}
                      onChange={(event) => set('timezone', event.target.value)}
                      fullWidth
                      disabled={!canManage}
                    >
                      {TIMEZONES.map((zone) => (
                        <MenuItem key={zone} value={zone}>
                          {zone}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {isNew && (
              <Card>
                <CardHeader
                  title="How they get in"
                  slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                  subheader="Invite is the safer default — nobody but them ever knows a password."
                />
                <CardContent sx={{ pt: 0 }}>
                  <RadioGroup
                    value={accessMode}
                    onChange={(event) => setAccessMode(event.target.value as 'invite' | 'password')}
                  >
                    <FormControlLabel
                      value="invite"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2">Invite by email</Typography>
                          <Typography variant="caption" color="text.secondary">
                            We email them a link to join the store and choose their own password. The
                            link works for 7 days.
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="password"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2">Set a starting password</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Useful for a test account, or when you'll hand the password over in person.
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>

                  {accessMode === 'password' && (
                    <Box sx={{ mt: 2 }}>
                      <TextField
                        label="Starting password"
                        placeholder="At least 10 characters"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        error={Boolean(fieldErrors.password)}
                        helperText={fieldErrors.password}
                        fullWidth
                        autoComplete="new-password"
                      />
                      <PasswordRules value={password} />
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                          <Switch
                            checked={mustChange}
                            onChange={(event) => setMustChange(event.target.checked)}
                          />
                        }
                        label="Force a password change at first sign-in"
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Roles"
                slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                subheader="A role is a bundle of permissions. Someone with no role can sign in and see nothing."
              />
              <CardContent sx={{ pt: 0 }}>
                {superAdmin ? (
                  <Alert severity="info" icon={<ShieldIcon />}>
                    Super admins bypass every permission check, so roles do not apply to this account.
                  </Alert>
                ) : roles.isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Stack spacing={0.5}>
                    {(roles.data?.roles ?? []).map((role) => (
                      <FormControlLabel
                        key={role.id}
                        control={
                          <Checkbox
                            checked={roleIds.includes(role.id)}
                            disabled={!canManage}
                            onChange={(event) =>
                              setRoleIds((current) =>
                                event.target.checked
                                  ? [...current, role.id]
                                  : current.filter((value) => value !== role.id),
                              )
                            }
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{role.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {role.description ?? `${role.permission_count} permissions`}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                    {roleIds.length === 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Pick at least one role, or make the account a super admin. The server refuses
                        an account that can sign in but do nothing.
                      </Alert>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {!isNew && (
              <Card>
                <CardHeader
                  title="What this account can actually do"
                  slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
                  subheader="Resolved from their roles — the answer to “why can't they see Orders?”"
                />
                <CardContent sx={{ pt: 0 }}>
                  {effective.isLoading ? (
                    <CircularProgress size={20} />
                  ) : effective.data?.is_super_admin ? (
                    <Typography variant="body2" color="text.secondary">
                      Everything — this is a super admin.
                    </Typography>
                  ) : (effective.data?.permissions.length ?? 0) === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nothing yet.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {(effective.data?.permissions ?? []).map((slug) => (
                        <Chip key={slug} label={slug} size="small" variant="outlined" sx={{ height: 20 }} />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            {!isNew && (
              <Card>
                <CardHeader title="Status" slotProps={{ title: { variant: 'subtitle1' } }} />
                <CardContent sx={{ pt: 0 }}>
                  <Stack spacing={1.5}>
                    <Chip
                      label={person?.status}
                      color={person?.status === 'active' ? 'success' : 'default'}
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Last signed in{' '}
                      {person?.last_login_at ? formatRelative(person.last_login_at) : 'never'}
                    </Typography>

                    {canManage && !isSelf && (
                      <>
                        <Divider />
                        {person?.status === 'suspended' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => runAction('activate')}
                            disabled={accountAction.isPending}
                          >
                            Reactivate account
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => runAction('suspend')}
                            disabled={accountAction.isPending}
                          >
                            Suspend account
                          </Button>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Suspending signs them out everywhere immediately.
                        </Typography>
                      </>
                    )}

                    {isSelf && (
                      <Typography variant="caption" color="text.secondary">
                        This is your own account — suspend and delete are disabled so you cannot lock
                        yourself out.
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {isSuperAdmin && (
              <Card>
                <CardHeader title="Access level" slotProps={{ title: { variant: 'subtitle1' } }} />
                <CardContent sx={{ pt: 0 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={superAdmin}
                        disabled={!canManage || (isSelf && superAdmin)}
                        onChange={(event) => setSuperAdmin(event.target.checked)}
                      />
                    }
                    label="Super admin"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Bypasses every permission check, including the ones protecting this screen. Only
                    an existing super admin can grant it.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {!isNew && canManage && person?.status === 'invited' && (
              <Card>
                <CardHeader title="Invitation" slotProps={{ title: { variant: 'subtitle1' } }} />
                <CardContent sx={{ pt: 0 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    disabled={resending}
                    onClick={async () => {
                      setResending(true)
                      try {
                        await api.post(`/admin-users/${person.id}/resend-invitation`)
                        setToast(`Invitation sent again to ${person.email}`)
                      } catch (caught) {
                        setToast(caught instanceof ApiError ? caught.message : 'Could not send the invitation.')
                      } finally {
                        setResending(false)
                      }
                    }}
                  >
                    {resending ? 'Sending…' : 'Resend invitation'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    A new link replaces the old one, which stops working.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {!isNew && canManage && (
              <Card>
                <CardHeader title="Password" slotProps={{ title: { variant: 'subtitle1' } }} />
                <CardContent sx={{ pt: 0 }}>
                  <Button size="small" variant="outlined" onClick={() => setResetOpen(true)} fullWidth>
                    Set a new password
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Use this for an invited account, or when someone is locked out.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {!isNew && canManage && !isSelf && (
              <Card>
                <CardContent>
                  <Button color="error" onClick={destroy} disabled={remove.isPending} fullWidth>
                    Delete account
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Their audit history is kept — only the login is removed.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <ResetPasswordDialog
        open={resetOpen}
        pending={resetPassword.isPending}
        onClose={() => setResetOpen(false)}
        onSubmit={(input) =>
          resetPassword.mutate(input, {
            onSuccess: () => {
              setResetOpen(false)
              setToast('Password updated')
              void query.refetch()
            },
            onError: (error) => {
              setResetOpen(false)
              handleError(error, 'Could not set the password')
            },
          })
        }
      />

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

function PasswordRules({ value }: { value: string }) {
  return (
    <List dense sx={{ py: 0.5 }}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <ListItem key={rule.label} sx={{ py: 0, minHeight: 22 }}>
            <ListItemIcon sx={{ minWidth: 22 }}>
              <CheckIcon sx={{ fontSize: 14, color: met ? 'success.main' : 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText
              primary={rule.label}
              slotProps={{
                primary: {
                  variant: 'caption',
                  sx: { color: met ? 'success.main' : 'text.secondary' },
                },
              }}
            />
          </ListItem>
        )
      })}
    </List>
  )
}

function ResetPasswordDialog({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (input: {
    new_password: string
    must_change_password: boolean
    revoke_sessions: boolean
  }) => void
}) {
  const [value, setValue] = useState('')
  const [mustChange, setMustChange] = useState(true)
  const [revoke, setRevoke] = useState(true)

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const valid = PASSWORD_RULES.every((rule) => rule.test(value))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Set a new password</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body2" sx={{ mb: 2 }}>
          You'll need to pass this on to them yourself — it is not emailed anywhere.
        </DialogContentText>
        <TextField
          label="New password"
          placeholder="At least 10 characters"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          fullWidth
          autoComplete="new-password"
          autoFocus
        />
        <PasswordRules value={value} />
        <FormControlLabel
          control={<Switch checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />}
          label="Force a change at next sign-in"
        />
        <FormControlLabel
          control={<Switch checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />}
          label="Sign them out everywhere"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!valid || pending}
          onClick={() =>
            onSubmit({ new_password: value, must_change_password: mustChange, revoke_sessions: revoke })
          }
        >
          {pending ? 'Saving…' : 'Set password'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
