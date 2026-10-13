import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Divider,
  FormControlLabel,
  Grid,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControl,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Code as VariableIcon,
  Send as TestIcon,
} from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import { ComplianceNotes } from './ComplianceNotes'
import { MessagePreview } from './MessagePreview'
import {
  CHANNEL_LABEL,
  useMessagingCatalogue,
  useSaveTemplate,
  useSenders,
  useTemplate,
  useTestSend,
  type Category,
  type Channel,
} from './useMessaging'

/**
 * Writing one message.
 *
 * The screen is in two halves and that is the whole idea: the form on the left,
 * and on the right what the customer will see, what it will cost and what stops
 * it being sent — all three updating as you type. Messaging goes wrong in ways
 * that are invisible in a form: a curly apostrophe that triples the bill, a
 * subject that is cut off, an unsubscribe line that was never added. None of
 * them are noticeable in a textarea and all of them are obvious in a preview.
 *
 * The compliance panel is the server's answer, refetched on every save, so the
 * editor cannot be more optimistic than the thing that refuses the send. What is
 * computed locally — the SMS segment estimate while typing — is explicitly an
 * estimate; the saved template carries the authoritative count.
 */

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXTENDED = '^{}\\[~]|€'

/** A live estimate while typing. The server's count is the one that bills. */
function estimateSms(body: string) {
  let unicode = false
  let units = 0
  let offender: string | null = null
  for (const character of body) {
    if (GSM_BASIC.includes(character)) units += 1
    else if (GSM_EXTENDED.includes(character)) units += 2
    else {
      unicode = true
      if (!offender) offender = character
    }
  }
  const characters = [...body].length
  const perSegment = unicode ? (characters <= 70 ? 70 : 67) : units <= 160 ? 160 : 153
  const measured = unicode ? characters : units
  return {
    encoding: (unicode ? 'UCS-2' : 'GSM-7') as 'UCS-2' | 'GSM-7',
    characters,
    billedUnits: measured,
    segments: measured === 0 ? 0 : Math.ceil(measured / perSegment),
    perSegment,
    unsupportedCharacter: offender,
  }
}

interface Draft {
  event_key: string
  channel: Channel
  category: Category
  name: string
  description: string
  subject: string
  preheader: string
  header_text: string
  body: string
  footer_text: string
  sender_id: number | null
  dlt_template_id: string
  provider_template_id: string
  approval_status: string
  is_active: boolean
  sample_variables: Record<string, string>
}

const EMPTY: Draft = {
  event_key: '',
  channel: 'whatsapp',
  category: 'marketing',
  name: '',
  description: '',
  subject: '',
  preheader: '',
  header_text: '',
  body: '',
  footer_text: '',
  sender_id: null,
  dlt_template_id: '',
  provider_template_id: '',
  approval_status: 'draft',
  is_active: false,
  sample_variables: {},
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g

export function TemplateEditorPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = params.id === 'new' || params.id === undefined
  const id = isNew ? null : Number(params.id)

  const template = useTemplate(id)
  const catalogue = useMessagingCatalogue()
  const senders = useSenders()
  const save = useSaveTemplate()
  const testSend = useTestSend()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [variableMenu, setVariableMenu] = useState<HTMLElement | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testTo, setTestTo] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!template.data) return
    const row = template.data
    setDraft({
      event_key: row.event_key,
      channel: row.channel,
      category: row.category,
      name: row.name,
      description: row.description ?? '',
      subject: row.subject ?? '',
      preheader: row.preheader ?? '',
      header_text: row.header_text ?? '',
      body: row.body,
      footer_text: row.footer_text ?? '',
      sender_id: row.sender_id,
      dlt_template_id: row.dlt_template_id ?? '',
      provider_template_id: row.provider_template_id ?? '',
      approval_status: row.approval_status ?? 'not_required',
      is_active: row.is_active,
      sample_variables: row.sample_variables ?? {},
    })
    setDirty(false)
  }, [template.data])

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setDirty(true)
  }

  const variables = useMemo(() => {
    const found: string[] = []
    for (const text of [draft.subject, draft.header_text, draft.body, draft.footer_text]) {
      for (const match of (text ?? '').matchAll(PLACEHOLDER)) {
        if (!found.includes(match[1])) found.push(match[1])
      }
    }
    return found
  }, [draft.subject, draft.header_text, draft.body, draft.footer_text])

  const examples = useMemo(() => {
    const map = new Map((catalogue.data?.variables ?? []).map((variable) => [variable.key, variable.example]))
    return map
  }, [catalogue.data])

  /** The preview, filled from the sample values and then the catalogue examples. */
  const filled = (text: string) =>
    (text ?? '').replace(PLACEHOLDER, (_whole, key: string) =>
      draft.sample_variables[key] || examples.get(key) || key.replace(/[_.]/g, ' '),
    )

  const channelSenders = (senders.data?.senders ?? []).filter((sender) => sender.channel === draft.channel)
  const sender = channelSenders.find((candidate) => candidate.id === draft.sender_id) ?? channelSenders[0] ?? null
  const smsEstimate = draft.channel === 'sms' ? estimateSms(filled(draft.body)) : null

  function insertVariable(key: string) {
    const token = `{{${key}}}`
    const input = bodyRef.current
    if (!input) {
      patch({ body: `${draft.body}${token}` })
      return
    }
    const start = input.selectionStart ?? draft.body.length
    const end = input.selectionEnd ?? start
    const next = `${draft.body.slice(0, start)}${token}${draft.body.slice(end)}`
    patch({ body: next })
    // Put the caret after what was just inserted, so several in a row work.
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function onSave() {
    const payload: Record<string, unknown> = {
      event_key: draft.event_key.trim(),
      channel: draft.channel,
      category: draft.category,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      subject: draft.channel === 'email' ? draft.subject.trim() || null : null,
      preheader: draft.channel === 'email' ? draft.preheader.trim() || null : null,
      header_text: draft.channel === 'whatsapp' ? draft.header_text.trim() || null : null,
      body: draft.body,
      footer_text: draft.footer_text.trim() || null,
      sender_id: draft.sender_id,
      dlt_template_id: draft.dlt_template_id.trim() || null,
      provider_template_id: draft.provider_template_id.trim() || null,
      approval_status: draft.approval_status,
      is_active: draft.is_active,
      sample_variables: Object.keys(draft.sample_variables).length > 0 ? draft.sample_variables : null,
    }

    const result = await save.mutateAsync({ id, input: payload })
    setDirty(false)
    setSaved('Saved')
    if (isNew) navigate(`/notifications/templates/${result.id}`, { replace: true })
  }

  if (!isNew && template.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  const serverViolations = template.data?.violations ?? []

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            startIcon={<BackIcon />}
            onClick={() => navigate('/notifications/templates')}
            sx={{ mb: 1, color: tokens.subdued }}
          >
            Message templates
          </Button>
        }
        title={isNew ? 'New template' : draft.name || 'Template'}
        subtitle={isNew ? undefined : `${CHANNEL_LABEL[draft.channel]} · ${draft.event_key}`}
        actions={
          <Stack direction="row" spacing={1}>
            {!isNew && (
              <Button startIcon={<TestIcon />} onClick={() => setTestOpen(true)} disabled={dirty}>
                Send a test
              </Button>
            )}
            <Button variant="contained" onClick={onSave} disabled={save.isPending || (!dirty && !isNew)}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        }
      />

      {save.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(save.error as Error).message}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* ── the form ───────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardHeader
                title="What this is"
                slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                sx={{ pb: 0 }}
              />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    placeholder="Order confirmed — WhatsApp"
                    size="small"
                    fullWidth
                    value={draft.name}
                    onChange={(event) => patch({ name: event.target.value })}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Event key"
                      placeholder="order.confirmed"
                      size="small"
                      fullWidth
                      helperText="What the code asks for when it wants this message."
                      value={draft.event_key}
                      onChange={(event) => patch({ event_key: event.target.value })}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="channel-label">Channel</InputLabel>
                      <Select
                        labelId="channel-label"
                        label="Channel"
                        value={draft.channel}
                        onChange={(event) => patch({ channel: event.target.value as Channel, sender_id: null })}
                      >
                        {(catalogue.data?.channels ?? []).map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="category-label">Type</InputLabel>
                    <Select
                      labelId="category-label"
                      label="Type"
                      value={draft.category}
                      onChange={(event) => patch({ category: event.target.value as Category })}
                    >
                      {(catalogue.data?.categories ?? []).map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box>
                            <Typography sx={{ fontSize: 13.5 }}>{option.label}</Typography>
                            <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>{option.help}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="sender-label">Send from</InputLabel>
                    <Select
                      labelId="sender-label"
                      label="Send from"
                      value={draft.sender_id ?? ''}
                      onChange={(event) =>
                        patch({ sender_id: Number(event.target.value) || null })
                      }
                    >
                      <MenuItem value="">
                        <em>The channel default</em>
                      </MenuItem>
                      {channelSenders.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                          {option.name}
                          {option.delivers ? '' : ' — simulated'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader
                title="The message"
                slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                action={
                  <Button size="small" startIcon={<VariableIcon />} onClick={(event) => setVariableMenu(event.currentTarget)}>
                    Insert a field
                  </Button>
                }
                sx={{ pb: 0 }}
              />
              <CardContent>
                <Stack spacing={2}>
                  {draft.channel === 'email' && (
                    <>
                      <TextField
                        label="Subject"
                        placeholder="Your order is on its way"
                        size="small"
                        fullWidth
                        value={draft.subject}
                        onChange={(event) => patch({ subject: event.target.value })}
                        helperText={`${draft.subject.length} characters — most inboxes cut off around 70.`}
                      />
                      <TextField
                        label="Preheader"
                        placeholder="The grey line after the subject"
                        size="small"
                        fullWidth
                        value={draft.preheader}
                        onChange={(event) => patch({ preheader: event.target.value })}
                      />
                    </>
                  )}

                  {draft.channel === 'whatsapp' && (
                    <TextField
                      label="Header"
                      placeholder="Order update"
                      size="small"
                      fullWidth
                      value={draft.header_text}
                      onChange={(event) => patch({ header_text: event.target.value })}
                    />
                  )}

                  <TextField
                    label="Body"
                    placeholder="Hi {{first_name}}, …"
                    size="small"
                    fullWidth
                    multiline
                    minRows={8}
                    value={draft.body}
                    onChange={(event) => patch({ body: event.target.value })}
                    inputRef={bodyRef}
                    slotProps={{ htmlInput: { 'data-field': 'body' } }}
                  />

                  <TextField
                    label="Footer"
                    placeholder={draft.channel === 'email' ? 'Not interested? {{unsubscribe_url}}' : 'Reply STOP to stop'}
                    size="small"
                    fullWidth
                    value={draft.footer_text}
                    onChange={(event) => patch({ footer_text: event.target.value })}
                  />
                </Stack>
              </CardContent>
            </Card>

            {(draft.channel === 'sms' || draft.channel === 'whatsapp') && (
              <Card variant="outlined">
                <CardHeader
                  title={draft.channel === 'sms' ? 'DLT registration' : 'Meta approval'}
                  subheader={
                    draft.channel === 'sms'
                      ? 'Indian operators reject commercial SMS whose wording is not registered.'
                      : 'WhatsApp will not deliver a business-initiated message from an unapproved template.'
                  }
                  slotProps={{
                    title: { sx: { fontSize: 14, fontWeight: 600 } },
                    subheader: { sx: { fontSize: 12, color: tokens.subdued } },
                  }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <Stack spacing={2}>
                    {draft.channel === 'sms' ? (
                      <TextField
                        label="DLT template ID"
                        placeholder="1307161234567890123"
                        size="small"
                        fullWidth
                        value={draft.dlt_template_id}
                        onChange={(event) => patch({ dlt_template_id: event.target.value })}
                        helperText="From the DLT portal, against the header this sender uses."
                      />
                    ) : (
                      <>
                        <TextField
                          label="Template name with the provider"
                          placeholder="order_confirmed_v2"
                          size="small"
                          fullWidth
                          value={draft.provider_template_id}
                          onChange={(event) => patch({ provider_template_id: event.target.value })}
                        />
                        <FormControl size="small" fullWidth>
                          <InputLabel id="approval-label">Approval</InputLabel>
                          <Select
                            labelId="approval-label"
                            label="Approval"
                            value={draft.approval_status}
                            onChange={(event) => patch({ approval_status: event.target.value })}
                          >
                            <MenuItem value="draft">Not submitted</MenuItem>
                            <MenuItem value="pending">Submitted, waiting</MenuItem>
                            <MenuItem value="approved">Approved</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                          </Select>
                        </FormControl>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {variables.length > 0 && (
              <Card variant="outlined">
                <CardHeader
                  title="Sample values"
                  subheader="Used for the preview and for a test send, so nobody has to imagine what it reads like."
                  slotProps={{
                    title: { sx: { fontSize: 14, fontWeight: 600 } },
                    subheader: { sx: { fontSize: 12, color: tokens.subdued } },
                  }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <Stack spacing={1.5}>
                    {variables.map((key) => (
                      <TextField
                        key={key}
                        label={key}
                        size="small"
                        fullWidth
                        placeholder={examples.get(key) ?? ''}
                        value={draft.sample_variables[key] ?? ''}
                        onChange={(event) =>
                          patch({ sample_variables: { ...draft.sample_variables, [key]: event.target.value } })
                        }
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.is_active}
                      onChange={(event) => patch({ is_active: event.target.checked })}
                      slotProps={{ input: { 'aria-label': 'Template is on' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 13.5 }}>Use this template</Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.subdued }}>
                        While it is off, nothing sends from it — events fall through and campaigns refuse to start.
                      </Typography>
                    </Box>
                  }
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* ── the picture ────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: 'sticky', top: 16 }}>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardHeader
                  title="What they will see"
                  slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <MessagePreview
                    channel={draft.channel}
                    subject={filled(draft.subject)}
                    preheader={filled(draft.preheader)}
                    headerText={filled(draft.header_text)}
                    body={filled(draft.body)}
                    footerText={filled(draft.footer_text)}
                    from={
                      sender
                        ? sender.from_email ?? sender.sms_header ?? sender.display_phone ?? sender.name
                        : 'No sender chosen'
                    }
                    sms={smsEstimate}
                    note={sender && !sender.delivers ? 'This sender is simulated — nothing is delivered yet.' : null}
                  />
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardHeader
                  title="Before it can send"
                  subheader={dirty ? 'Checked against the last save.' : undefined}
                  slotProps={{
                    title: { sx: { fontSize: 14, fontWeight: 600 } },
                    subheader: { sx: { fontSize: 12, color: tokens.warning } },
                  }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  {isNew ? (
                    <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                      Save it once and every rule that applies — DLT, WhatsApp approval, opt-out, sender setup — is
                      checked and listed here.
                    </Typography>
                  ) : (
                    <ComplianceNotes
                      violations={serverViolations}
                      emptyMessage="Nothing stands in the way. This template can send."
                    />
                  )}
                </CardContent>
              </Card>

              {template.data && template.data.usage_count > 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={3}>
                      <Box>
                        <Typography sx={{ fontSize: 20, fontWeight: 600 }}>
                          {template.data.stats.sent_30d.toLocaleString('en-IN')}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.subdued }}>sent, last 30 days</Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box>
                        <Typography sx={{ fontSize: 20, fontWeight: 600, color: template.data.stats.failed_30d > 0 ? tokens.critical : undefined }}>
                          {template.data.stats.failed_30d}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.subdued }}>failed</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {/* Insert menu, grouped by where the value comes from. */}
      <Menu anchorEl={variableMenu} open={Boolean(variableMenu)} onClose={() => setVariableMenu(null)}>
        {(catalogue.data?.variables ?? []).map((variable) => (
          <MenuItem
            key={variable.key}
            onClick={() => {
              insertVariable(variable.key)
              setVariableMenu(null)
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 13.5 }}>
                {variable.label}{' '}
                <Chip size="small" label={variable.scope} sx={{ height: 16, fontSize: 10, ml: 0.5 }} />
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>
                {`{{${variable.key}}}`} → {variable.example}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send a test</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
              Goes to you, with the sample values filled in. Consent and the frequency cap do not apply — the rules
              that stop a template sending still do.
            </Typography>
            <TextField
              label={draft.channel === 'email' ? 'Email address' : 'Phone number with country code'}
              placeholder={draft.channel === 'email' ? 'you@veylor.co.in' : '919876543210'}
              size="small"
              fullWidth
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
            />
            {testSend.isError && <Alert severity="error">{(testSend.error as Error).message}</Alert>}
            {testSend.isSuccess && (
              <Alert severity={testSend.data.simulated ? 'info' : 'success'}>
                {testSend.data.simulated
                  ? 'Recorded by the simulator — nothing was delivered, because no provider is connected yet. It is in the delivery log.'
                  : `Sent — ${testSend.data.status}.`}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Close</Button>
          <Button
            variant="contained"
            disabled={!testTo.trim() || testSend.isPending || id === null}
            onClick={() => {
              if (id === null) return
              testSend.mutate({ id, to: testTo.trim(), variables: draft.sample_variables })
            }}
          >
            {testSend.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(saved)}
        autoHideDuration={2000}
        onClose={() => setSaved(null)}
        message={saved ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
