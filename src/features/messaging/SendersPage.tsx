import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import {
  CHANNEL_LABEL,
  useMakeDefaultSender,
  useMessagingSettings,
  useSaveMessagingSettings,
  useSaveSender,
  useSenders,
  type Channel,
  type Sender,
} from './useMessaging'

/**
 * Who messages come from, and the rules everything is sent under.
 *
 * Two things on one screen because they are the same job: setting the shop up to
 * send. A sender is the identity — an email From address, a six-character SMS
 * header with the DLT entity that registered it, a WhatsApp business number —
 * and the settings below are the numbers every send is measured against.
 *
 * The honest part of this screen is the banner. Until a real provider is
 * connected nothing is delivered, and a Senders page that implies otherwise is
 * how a shop finds out three weeks later that its order confirmations were
 * being written to a log file.
 */

const CHANNEL_FIELDS: Record<Channel, { key: keyof Sender; label: string; placeholder: string; help?: string }[]> = {
  email: [
    { key: 'from_email', label: 'From address', placeholder: 'hello@veylor.co.in' },
    { key: 'from_name', label: 'From name', placeholder: 'Veylor' },
    { key: 'reply_to', label: 'Reply-to', placeholder: 'support@veylor.co.in' },
  ],
  sms: [
    {
      key: 'sms_header',
      label: 'Sender header',
      placeholder: 'VEYLOR',
      help: 'The six-character header registered on the DLT portal.',
    },
    { key: 'dlt_pe_id', label: 'Principal Entity ID', placeholder: '1101234567890123456' },
    { key: 'dlt_entity_name', label: 'Registered entity name', placeholder: 'Veylor Beauty Pvt Ltd' },
  ],
  whatsapp: [
    { key: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: '1029384756' },
    { key: 'phone_number_id', label: 'Phone number ID', placeholder: '1122334455' },
    { key: 'display_phone', label: 'Display number', placeholder: '+91 98765 43210' },
  ],
}

export function SendersPage() {
  const senders = useSenders()
  const save = useSaveSender()
  const makeDefault = useMakeDefaultSender()
  const settings = useMessagingSettings()
  const saveSettings = useSaveMessagingSettings()

  const [editing, setEditing] = useState<Sender | null>(null)
  const [creatingChannel, setCreatingChannel] = useState<Channel | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!settings.data) return
    const next: Record<string, string> = {}
    for (const row of settings.data.settings) next[row.setting_key] = row.value ?? row.default_value ?? ''
    setValues(next)
  }, [settings.data])

  const rows = senders.data?.senders ?? []
  const nothingDelivers = rows.length > 0 && rows.every((sender) => !sender.delivers)

  function openEditor(sender: Sender | null, channel?: Channel) {
    setEditing(sender)
    setCreatingChannel(sender ? null : (channel ?? 'email'))
    setForm(
      sender
        ? Object.fromEntries(
            Object.entries(sender)
              .filter(([, value]) => typeof value === 'string' || value === null)
              .map(([key, value]) => [key, (value as string) ?? '']),
          )
        : { name: '', provider: 'simulator', status: 'active' },
    )
  }

  const channel = editing?.channel ?? creatingChannel ?? 'email'

  return (
    <Box>
      <PageHeader title="Senders" subtitle="Who messages come from, and the rules they send under" />

      {nothingDelivers && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No provider is connected yet, so every message is recorded rather than delivered. Everything else works —
          templates, audiences, campaigns, the delivery log — and connecting a provider later is one field on the
          sender below.
        </Alert>
      )}

      <Grid container spacing={2}>
        {(['whatsapp', 'sms', 'email'] as Channel[]).map((key) => {
          const forChannel = rows.filter((sender) => sender.channel === key)
          return (
            <Grid key={key} size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardHeader
                  title={CHANNEL_LABEL[key]}
                  slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                  action={
                    <Button size="small" startIcon={<AddIcon />} onClick={() => openEditor(null, key)}>
                      Add
                    </Button>
                  }
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <Stack spacing={1.5}>
                    {forChannel.length === 0 && (
                      <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                        No sender for this channel yet.
                      </Typography>
                    )}
                    {forChannel.map((sender) => (
                      <Box
                        key={sender.id}
                        sx={{
                          border: `1px solid ${tokens.border}`,
                          borderRadius: 1.5,
                          p: 1.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: tokens.hover },
                        }}
                        onClick={() => openEditor(sender)}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{sender.name}</Typography>
                          {sender.is_default && (
                            <Chip size="small" label="default" sx={{ height: 18, fontSize: 10.5 }} />
                          )}
                          {!sender.delivers && (
                            <Chip
                              size="small"
                              label="simulated"
                              sx={{ height: 18, fontSize: 10.5, bgcolor: tokens.warningSurface, color: tokens.warning }}
                            />
                          )}
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: tokens.subdued }}>
                          {sender.from_email ?? sender.sms_header ?? sender.display_phone ?? 'Not configured'}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.faint, mt: 0.5 }}>
                          {sender.stats.templates_using} template
                          {sender.stats.templates_using === 1 ? '' : 's'} ·{' '}
                          {sender.stats.sent_30d.toLocaleString('en-IN')} sent in 30 days
                        </Typography>
                        {!sender.is_default && (
                          <Button
                            size="small"
                            sx={{ mt: 0.5, px: 0 }}
                            onClick={(event) => {
                              event.stopPropagation()
                              makeDefault.mutate(sender.id)
                            }}
                          >
                            Make default
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* ── the rules ───────────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardHeader
          title="Sending rules"
          subheader="Applied to every message, by every part of the shop."
          slotProps={{
            title: { sx: { fontSize: 14, fontWeight: 600 } },
            subheader: { sx: { fontSize: 12, color: tokens.subdued } },
          }}
          sx={{ pb: 0 }}
        />
        <CardContent>
          {settings.isLoading ? (
            <CircularProgress size={22} />
          ) : (
            <Grid container spacing={2}>
              {(settings.data?.settings ?? []).map((row) => (
                <Grid key={row.setting_key} size={{ xs: 12, sm: 6 }}>
                  {row.value_type === 'boolean' ? (
                    <FormControl size="small" fullWidth>
                      <InputLabel id={row.setting_key}>{row.label ?? row.setting_key}</InputLabel>
                      <Select
                        labelId={row.setting_key}
                        label={row.label ?? row.setting_key}
                        value={values[row.setting_key] ?? 'true'}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [row.setting_key]: event.target.value }))
                        }
                      >
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      label={row.label ?? row.setting_key}
                      size="small"
                      fullWidth
                      placeholder={row.default_value ?? ''}
                      helperText={row.description ?? undefined}
                      value={values[row.setting_key] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [row.setting_key]: event.target.value }))
                      }
                    />
                  )}
                </Grid>
              ))}
            </Grid>
          )}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              disabled={saveSettings.isPending}
              onClick={async () => {
                await saveSettings.mutateAsync(values)
                setToast('Rules saved')
              }}
            >
              {saveSettings.isPending ? 'Saving…' : 'Save rules'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={editing !== null || creatingChannel !== null} onClose={() => { setEditing(null); setCreatingChannel(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? editing.name : `New ${CHANNEL_LABEL[channel]} sender`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              size="small"
              fullWidth
              placeholder="Veylor transactional"
              helperText="What staff call it."
              value={form.name ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />

            {CHANNEL_FIELDS[channel].map((field) => (
              <TextField
                key={String(field.key)}
                label={field.label}
                size="small"
                fullWidth
                placeholder={field.placeholder}
                helperText={field.help}
                value={form[String(field.key)] ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [String(field.key)]: event.target.value }))
                }
              />
            ))}

            <FormControl size="small" fullWidth>
              <InputLabel id="provider-label">Provider</InputLabel>
              <Select
                labelId="provider-label"
                label="Provider"
                value={form.provider ?? 'simulator'}
                onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
              >
                <MenuItem value="simulator">Simulator — records, does not deliver</MenuItem>
                <MenuItem value="logging">Recorder — writes to the log only</MenuItem>
              </Select>
            </FormControl>

            <Typography sx={{ fontSize: 12, color: tokens.subdued }}>
              API keys are never stored here. When a provider is connected, its credentials live in the server’s
              environment and this row holds only the public half — which number, which header, which account.
            </Typography>

            {save.isError && <Alert severity="error">{(save.error as Error).message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditing(null); setCreatingChannel(null) }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.name?.trim() || save.isPending}
            onClick={async () => {
              const payload: Record<string, unknown> = { ...form, channel }
              delete payload.id
              delete payload.stats
              delete payload.delivers
              delete payload.config
              delete payload.is_default
              await save.mutateAsync({ id: editing?.id ?? null, input: payload })
              setEditing(null)
              setCreatingChannel(null)
              setToast('Sender saved')
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
