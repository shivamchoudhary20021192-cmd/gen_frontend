import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../../api/client'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { errorMessage, fieldErrors, isPlanError } from '../../../lib/errors'
import { CATEGORY_LABELS, type Connection, type ConnectionDetail, type Provider } from './integrationTypes'

type ConfigValue = string | number | boolean | null

interface Props {
  provider: Provider
  /** Editing: settings can change freely; keys only when replaced. */
  connection?: Connection
  /** Whether a connection of this category already exists (offer "make default"). */
  hasOthers: boolean
  onClose(): void
  onSaved(detail: ConnectionDetail): void
}

/**
 * The form for one provider, built from its manifest: the keys it needs
 * (secret ones masked and never shown again) and its plain settings.
 */
export function ConnectDialog({ provider, connection, hasOthers, onClose, onSaved }: Props) {
  const editing = Boolean(connection)
  const [name, setName] = useState(connection?.name ?? provider.name)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [config, setConfig] = useState<Record<string, ConfigValue>>(() => {
    const initial: Record<string, ConfigValue> = {}
    for (const field of provider.config_fields) initial[field.key] = connection?.config[field.key] ?? field.default ?? (field.type === 'boolean' ? false : '')
    return initial
  })
  const [makeDefault, setMakeDefault] = useState(!hasOthers)
  const [replacingKeys, setReplacingKeys] = useState(!editing)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<{ text: string; plan: boolean } | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const cleanConfig = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, value === '' ? null : value]))
      const filled = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim() !== ''))
      if (connection) {
        return api.patch<ConnectionDetail>(`/integrations/${connection.id}`, {
          name,
          config: cleanConfig,
          ...(replacingKeys ? { credentials: filled } : {}),
        })
      }
      return api.post<ConnectionDetail>('/integrations', { provider: provider.key, name, credentials: filled, config: cleanConfig, make_default: makeDefault })
    },
    onSuccess: onSaved,
    onError: (caught) => {
      setErrors(fieldErrors(caught))
      setError({ text: errorMessage(caught), plan: isPlanError(caught) })
    },
  })

  const missing = replacingKeys && provider.credential_fields.some((field) => field.required && !credentials[field.key]?.trim())

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit} noValidate autoComplete="off">
        <DialogTitle>
          {editing ? `${provider.name} settings` : `Connect ${provider.name}`}
          <Typography variant="body2" color="text.secondary">
            {CATEGORY_LABELS[provider.category]}
            {provider.docs_url && (
              <>
                {' · '}
                <Link href={provider.docs_url} target="_blank" rel="noopener">
                  Where to find these keys
                </Link>
              </>
            )}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && (error.plan ? <UpgradeNotice message={error.text} /> : <Alert severity="error">{error.text}</Alert>)}
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} helperText="To tell connections apart, such as “Razorpay – main account”." size="small" fullWidth />

            {editing && !replacingKeys ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                <Typography variant="body2">
                  Keys saved{connection?.credentials_hint ? ` (${connection.credentials_hint})` : ''}. They are encrypted and never shown again.
                </Typography>
                <Button size="small" onClick={() => setReplacingKeys(true)}>
                  Replace keys
                </Button>
              </Stack>
            ) : (
              provider.credential_fields.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  type={field.secret ? 'password' : 'text'}
                  value={credentials[field.key] ?? ''}
                  onChange={(event) => setCredentials({ ...credentials, [field.key]: event.target.value })}
                  placeholder={field.placeholder ?? undefined}
                  required={field.required}
                  error={Boolean(errors[field.key] || errors.credentials)}
                  helperText={errors[field.key] ?? field.help ?? ' '}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                  size="small"
                  fullWidth
                />
              ))
            )}

            {provider.config_fields.map((field) =>
              field.type === 'boolean' ? (
                <FormControlLabel
                  key={field.key}
                  control={<Switch checked={Boolean(config[field.key])} onChange={(event) => setConfig({ ...config, [field.key]: event.target.checked })} />}
                  label={field.label}
                />
              ) : (
                <TextField
                  key={field.key}
                  select={field.type === 'select'}
                  type={field.type === 'number' ? 'number' : 'text'}
                  label={field.label}
                  value={config[field.key] ?? ''}
                  onChange={(event) => setConfig({ ...config, [field.key]: field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value })}
                  required={field.required}
                  helperText={errors[field.key] ?? field.help ?? ' '}
                  error={Boolean(errors[field.key])}
                  size="small"
                  fullWidth
                >
                  {(field.options ?? []).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              ),
            )}

            {!editing && hasOthers && (
              <FormControlLabel
                control={<Switch checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />}
                label={`Use for ${CATEGORY_LABELS[provider.category].toLowerCase()} from now on`}
              />
            )}
            <Typography variant="caption">We check the keys with {provider.name} before saving. Test keys connect in test mode; nothing real is charged or sent.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={save.isPending || missing || !name.trim()}>
            {save.isPending ? 'Checking…' : editing ? 'Save' : 'Connect'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
