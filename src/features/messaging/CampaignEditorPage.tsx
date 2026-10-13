import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  PauseCircleOutlined as PauseIcon,
  PlayArrow as StartIcon,
  Schedule as ScheduleIcon,
  StopCircle as CancelIcon,
} from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import { ComplianceNotes } from './ComplianceNotes'
import { MessagePreview } from './MessagePreview'
import { RuleBuilder } from './RuleBuilder'
import { useSegmentOptions } from './useSegmentOptions'
import {
  CHANNEL_LABEL,
  useAudienceEstimate,
  useCampaign,
  useCampaignAction,
  useCampaignRecipients,
  useMessagingCatalogue,
  usePreflight,
  useSaveCampaign,
  useTemplates,
  type AudienceRule,
  type Campaign,
} from './useMessaging'

/**
 * One campaign, from draft to done.
 *
 * The screen changes shape with the campaign, because what someone needs from
 * it changes completely:
 *
 *   draft / scheduled / paused → a builder. Message, audience, schedule on the
 *     left; on the right, permanently, the two numbers that decide whether to
 *     press send: how many people this reaches and what would stop it.
 *
 *   sending / completed → a report. Counters, a progress bar and the recipient
 *     list with the reason against anyone who did not get it.
 *
 * The right-hand panel is not a "review step" at the end of a wizard. It is
 * visible the whole time, and it updates as the audience is edited, because the
 * number that changes someone's mind about a campaign is the audience size, and
 * finding it out three screens later is what makes people send the wrong thing.
 */

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: tokens.sand, fg: tokens.ink, label: 'Draft' },
  scheduled: { bg: tokens.infoSurface, fg: tokens.info, label: 'Scheduled' },
  sending: { bg: tokens.infoSurface, fg: tokens.info, label: 'Sending' },
  paused: { bg: tokens.warningSurface, fg: tokens.warning, label: 'Paused' },
  completed: { bg: tokens.successSurface, fg: tokens.success, label: 'Sent' },
  cancelled: { bg: tokens.sand, fg: tokens.subdued, label: 'Cancelled' },
  failed: { bg: tokens.criticalSurface, fg: tokens.critical, label: 'Failed' },
}

const RECIPIENT_REASON: Record<string, string> = {
  no_consent: 'Has not opted in',
  too_soon: 'Messaged too recently',
  quiet_hours: 'Outside the promotional window',
  no_recipient: 'No address',
  no_template: 'Template unavailable',
  blocked: 'Blocked by a rule',
  provider_failed: 'The provider refused it',
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Box sx={{ minWidth: 92 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 600, color: tone ?? tokens.inkStrong, lineHeight: 1.2 }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </Typography>
      <Typography sx={{ fontSize: 12, color: tokens.subdued }}>{label}</Typography>
    </Box>
  )
}

export function CampaignEditorPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const id = Number(params.id)

  const campaign = useCampaign(Number.isFinite(id) ? id : null)
  const catalogue = useMessagingCatalogue()
  const segments = useSegmentOptions()
  const save = useSaveCampaign()
  const act = useCampaignAction(id)
  const estimate = useAudienceEstimate()

  const status = campaign.data?.status ?? 'draft'
  const editing = ['draft', 'scheduled', 'paused'].includes(status)
  const preflight = usePreflight(Number.isFinite(id) ? id : null, editing)
  const templates = useTemplates(campaign.data ? { channel: campaign.data.channel } : {})
  const recipients = useCampaignRecipients(id, {})

  const [draft, setDraft] = useState<Partial<Campaign> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [confirmStart, setConfirmStart] = useState(false)

  useEffect(() => {
    if (campaign.data && draft === null) setDraft(campaign.data)
  }, [campaign.data, draft])

  function patch(changes: Partial<Campaign>) {
    setDraft((current) => ({ ...(current ?? {}), ...changes }))
    setDirty(true)
  }

  const template = (templates.data?.templates ?? []).find((row) => row.id === draft?.template_id) ?? null

  /** A live count while the audience is edited, before anything is saved. */
  const audienceSpec = useMemo(
    () => ({
      channel: draft?.channel,
      marketing: template ? template.category === 'marketing' : true,
      audience_type: draft?.audience_type ?? 'segment',
      segment_id: draft?.segment_id ?? null,
      rules: draft?.rules ?? [],
      rules_operator: draft?.rules_operator ?? 'all',
      exclude_recent_hours: draft?.exclude_recent_hours ?? null,
    }),
    [draft, template],
  )

  useEffect(() => {
    if (!editing || !audienceSpec.channel) return
    if (audienceSpec.audience_type === 'segment' && !audienceSpec.segment_id) return
    if (audienceSpec.audience_type === 'manual') return
    const timer = setTimeout(() => estimate.mutate(audienceSpec), 400)
    return () => clearTimeout(timer)
    // The mutation object is recreated on every render; depending on it loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(audienceSpec), editing])

  async function persist() {
    if (!draft) return
    await save.mutateAsync({
      id,
      input: {
        name: draft.name,
        description: draft.description ?? null,
        template_id: draft.template_id ?? null,
        audience_type: draft.audience_type,
        segment_id: draft.segment_id ?? null,
        rules: draft.rules ?? null,
        rules_operator: draft.rules_operator,
        exclude_recent_hours: draft.exclude_recent_hours ?? null,
        throttle_per_minute: draft.throttle_per_minute ?? null,
        variables: draft.variables ?? null,
      },
    })
    setDirty(false)
    await preflight.refetch()
  }

  if (campaign.isLoading || !draft) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  const stats = campaign.data?.stats
  const reach = estimate.data ?? preflight.data?.audience
  const campaignVariables = draft.variables ?? {}
  const templateVariables = template?.variables ?? []
  /** Only the fields a campaign has to supply by hand — the rest resolve per person. */
  const manualVariables = templateVariables.filter((key) =>
    ['offer_code', 'offer_ends', 'link'].includes(key) || !(catalogue.data?.variables ?? []).some((variable) => variable.key === key),
  )

  return (
    <Box>
      <PageHeader
        back={
          <Button
            size="small"
            startIcon={<BackIcon />}
            onClick={() => navigate('/notifications/campaigns')}
            sx={{ mb: 1, color: tokens.subdued }}
          >
            Campaigns
          </Button>
        }
        title={draft.name ?? 'Campaign'}
        subtitle={`${CHANNEL_LABEL[draft.channel ?? 'whatsapp']} · ${style.label}`}
        actions={
          <Stack direction="row" spacing={1}>
            {editing && (
              <Button onClick={persist} disabled={!dirty || save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            )}
            {status === 'draft' && (
              <>
                <Button startIcon={<ScheduleIcon />} onClick={() => setScheduling(true)}>
                  Schedule
                </Button>
                <Button
                  variant="contained"
                  startIcon={<StartIcon />}
                  disabled={!preflight.data?.ready || dirty}
                  onClick={() => setConfirmStart(true)}
                >
                  Send now
                </Button>
              </>
            )}
            {status === 'scheduled' && (
              <Button startIcon={<PauseIcon />} onClick={() => act.mutate({ action: 'pause' })}>
                Unschedule
              </Button>
            )}
            {status === 'sending' && (
              <Button startIcon={<PauseIcon />} onClick={() => act.mutate({ action: 'pause' })}>
                Pause
              </Button>
            )}
            {status === 'paused' && (
              <Button variant="contained" startIcon={<StartIcon />} onClick={() => act.mutate({ action: 'resume' })}>
                Resume
              </Button>
            )}
            {['sending', 'paused', 'scheduled'].includes(status) && (
              <Button color="error" startIcon={<CancelIcon />} onClick={() => act.mutate({ action: 'cancel' })}>
                Cancel
              </Button>
            )}
          </Stack>
        }
      />

      {act.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(act.error as Error).message}
        </Alert>
      )}
      {campaign.data?.last_error && status === 'paused' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {campaign.data.last_error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            {/* ── what is being sent ──────────────────────────────────────── */}
            <Card variant="outlined">
              <CardHeader title="The message" slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }} sx={{ pb: 0 }} />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Campaign name"
                    placeholder="September edit"
                    size="small"
                    fullWidth
                    disabled={!editing}
                    value={draft.name ?? ''}
                    onChange={(event) => patch({ name: event.target.value })}
                  />

                  <FormControl size="small" fullWidth disabled={!editing}>
                    <InputLabel id="template-label">Template</InputLabel>
                    <Select
                      labelId="template-label"
                      label="Template"
                      value={draft.template_id ?? ''}
                      onChange={(event) =>
                        patch({ template_id: Number(event.target.value) || null })
                      }
                    >
                      <MenuItem value="">
                        <em>Choose one</em>
                      </MenuItem>
                      {(templates.data?.templates ?? [])
                        .filter((row) => row.category !== 'authentication')
                        .map((row) => (
                          <MenuItem key={row.id} value={row.id} disabled={!row.can_send}>
                            {row.name}
                            {row.can_send ? '' : ' — cannot send yet'}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>

                  {manualVariables.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 12.5, color: tokens.subdued, mb: 1 }}>
                        This template asks for values that are the same for everyone who receives it.
                      </Typography>
                      <Stack spacing={1.5}>
                        {manualVariables.map((key) => (
                          <TextField
                            key={key}
                            label={key}
                            size="small"
                            fullWidth
                            disabled={!editing}
                            value={campaignVariables[key] ?? ''}
                            onChange={(event) =>
                              patch({ variables: { ...campaignVariables, [key]: event.target.value } })
                            }
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* ── who it goes to ──────────────────────────────────────────── */}
            <Card variant="outlined">
              <CardHeader
                title="Who it goes to"
                slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                sx={{ pb: 0 }}
              />
              <CardContent>
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    disabled={!editing}
                    value={draft.audience_type ?? 'segment'}
                    onChange={(_event, value) => value && patch({ audience_type: value })}
                  >
                    <ToggleButton value="segment">A saved segment</ToggleButton>
                    <ToggleButton value="rules">Rules</ToggleButton>
                    <ToggleButton value="all">Everyone</ToggleButton>
                  </ToggleButtonGroup>

                  {draft.audience_type === 'segment' && (
                    <FormControl size="small" fullWidth disabled={!editing}>
                      <InputLabel id="segment-label">Segment</InputLabel>
                      <Select
                        labelId="segment-label"
                        label="Segment"
                        value={draft.segment_id ?? ''}
                        onChange={(event) =>
                          patch({ segment_id: Number(event.target.value) || null })
                        }
                      >
                        <MenuItem value="">
                          <em>Choose one</em>
                        </MenuItem>
                        {(segments.data?.segments ?? []).map((segment) => (
                          <MenuItem key={segment.id} value={segment.id}>
                            {segment.name}
                            <Typography component="span" sx={{ fontSize: 11.5, color: tokens.faint, ml: 1 }}>
                              {segment.segment_type === 'auto' ? 'rule-based' : `${segment.customer_count} people`}
                            </Typography>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {draft.audience_type === 'rules' && (
                    <RuleBuilder
                      fields={catalogue.data?.audience.fields ?? []}
                      rules={(draft.rules ?? []) as AudienceRule[]}
                      operator={draft.rules_operator ?? 'all'}
                      disabled={!editing}
                      onChange={(rules) => patch({ rules })}
                      onOperatorChange={(operator) => patch({ rules_operator: operator })}
                    />
                  )}

                  <Divider />

                  <TextField
                    label="Leave alone anyone messaged in the last (hours)"
                    size="small"
                    type="number"
                    fullWidth
                    disabled={!editing}
                    placeholder="72"
                    helperText="The commonest mistake in bulk messaging is two campaigns hitting the same people in one week."
                    value={draft.exclude_recent_hours ?? ''}
                    onChange={(event) =>
                      patch({ exclude_recent_hours: event.target.value === '' ? null : Number(event.target.value) })
                    }
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* ── the report, once it is running ──────────────────────────── */}
            {!editing && stats && (
              <Card variant="outlined">
                <CardHeader
                  title="How it went"
                  slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
                    <Stat label="in the audience" value={stats.total_recipients} />
                    <Stat label="sent" value={stats.sent} />
                    <Stat label="delivered" value={stats.delivered} tone={tokens.success} />
                    <Stat label="failed" value={stats.failed} tone={stats.failed > 0 ? tokens.critical : undefined} />
                    <Stat label="skipped" value={stats.skipped} tone={stats.skipped > 0 ? tokens.warning : undefined} />
                    <Stat label="spent" value={`₹${stats.cost.toFixed(2)}`} />
                  </Stack>
                  {status === 'sending' && (
                    <Box sx={{ mt: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={
                          stats.total_recipients > 0
                            ? Math.round(((stats.sent + stats.failed + stats.skipped) / stats.total_recipients) * 100)
                            : 0
                        }
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography sx={{ fontSize: 12, color: tokens.subdued, mt: 0.75 }}>
                        {stats.pending.toLocaleString('en-IN')} still to go — this page updates itself.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {!editing && (recipients.data?.recipients.length ?? 0) > 0 && (
              <Card variant="outlined">
                <CardHeader
                  title="Everyone in it"
                  subheader={`${recipients.data?.pagination.total.toLocaleString('en-IN')} people`}
                  slotProps={{
                    title: { sx: { fontSize: 14, fontWeight: 600 } },
                    subheader: { sx: { fontSize: 12, color: tokens.subdued } },
                  }}
                  sx={{ pb: 0 }}
                />
                <CardContent sx={{ px: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell>Sent to</TableCell>
                        <TableCell>Outcome</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(recipients.data?.recipients ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>{row.recipient}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              sx={{
                                fontSize: 12.5,
                                color:
                                  row.status === 'delivered'
                                    ? tokens.success
                                    : row.status === 'failed'
                                      ? tokens.critical
                                      : row.status === 'skipped'
                                        ? tokens.warning
                                        : tokens.subdued,
                              }}
                            >
                              {row.status === 'skipped'
                                ? RECIPIENT_REASON[row.skip_reason ?? ''] ?? 'Skipped'
                                : row.status === 'failed'
                                  ? row.error_message ?? 'Failed'
                                  : row.status}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* ── the panel that decides ──────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: 'sticky', top: 16 }}>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardHeader
                  title="Reach"
                  slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  {reach ? (
                    <Stack spacing={1}>
                      <Typography sx={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
                        {reach.eligible.toLocaleString('en-IN')}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                        people will receive this
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Stack spacing={0.5}>
                        <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>
                          {reach.matched.toLocaleString('en-IN')} match the audience
                        </Typography>
                        {reach.no_consent > 0 && (
                          <Typography sx={{ fontSize: 12.5, color: tokens.warning }}>
                            {reach.no_consent.toLocaleString('en-IN')} have not opted in on this channel
                          </Typography>
                        )}
                        {reach.messaged_recently > 0 && (
                          <Typography sx={{ fontSize: 12.5, color: tokens.warning }}>
                            {reach.messaged_recently.toLocaleString('en-IN')} were messaged too recently
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                      Choose an audience and the count appears here.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {editing && (
                <Card variant="outlined">
                  <CardHeader
                    title="Before it can send"
                    subheader={dirty ? 'Save to re-check.' : undefined}
                    slotProps={{
                      title: { sx: { fontSize: 14, fontWeight: 600 } },
                      subheader: { sx: { fontSize: 12, color: tokens.warning } },
                    }}
                    sx={{ pb: 0 }}
                  />
                  <CardContent>
                    {/* An empty list means "nothing is wrong"; no answer at all
                        means "we have not asked yet", and the two must not look
                        the same — a green tick over an unchecked campaign is
                        worse than no tick. */}
                    {preflight.isPending || !preflight.data ? (
                      <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                        {preflight.isError
                          ? 'This campaign could not be checked yet — finish choosing a template and an audience.'
                          : 'Checking…'}
                      </Typography>
                    ) : (
                      <ComplianceNotes
                        violations={preflight.data.violations}
                        emptyMessage="Everything checks out. This is ready to send."
                      />
                    )}
                    {preflight.data?.quiet_hours && (
                      <Typography sx={{ fontSize: 12, color: tokens.subdued, mt: 1.5 }}>
                        {preflight.data.quiet_hours.message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              {template && (
                <Card variant="outlined">
                  <CardHeader
                    title="What they will see"
                    slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                    sx={{ pb: 0 }}
                  />
                  <CardContent>
                    <MessagePreview
                      channel={template.channel}
                      subject={template.subject}
                      headerText={template.header_text}
                      body={template.body}
                      footerText={template.footer_text}
                      from={template.sender_name}
                      sms={template.sms}
                    />
                    <Typography sx={{ fontSize: 11.5, color: tokens.faint, mt: 1 }}>
                      Fields are filled in per person when it sends.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {preflight.data && preflight.data.sample.length > 0 && editing && (
                <Card variant="outlined">
                  <CardHeader
                    title="A few who would get it"
                    slotProps={{ title: { sx: { fontSize: 14, fontWeight: 600 } } }}
                    sx={{ pb: 0 }}
                  />
                  <CardContent>
                    <Stack spacing={0.75}>
                      {preflight.data.sample.map((person) => (
                        <Typography key={person.id} sx={{ fontSize: 12.5, color: tokens.subdued }}>
                          {person.name} · {person.recipient}
                        </Typography>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {/* Sending is the one irreversible thing in this screen, so it is confirmed
          with the number rather than with the word "confirm". */}
      <Dialog open={confirmStart} onClose={() => setConfirmStart(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send to {preflight.data?.audience.eligible.toLocaleString('en-IN')} people?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: tokens.subdued }}>
            This starts immediately and cannot be taken back once a message has left. It can be paused, which stops
            the ones that have not been sent yet.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmStart(false)}>Not yet</Button>
          <Button
            variant="contained"
            onClick={async () => {
              await act.mutateAsync({ action: 'start' })
              setConfirmStart(false)
            }}
          >
            Send now
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scheduling} onClose={() => setScheduling(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Schedule this campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="When"
              type="datetime-local"
              size="small"
              fullWidth
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>
              Everything is checked again at that moment, so a promotional campaign scheduled outside{' '}
              {catalogue.data?.rules.promotional_window} will refuse rather than send.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduling(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!scheduleAt}
            onClick={async () => {
              await act.mutateAsync({
                action: 'schedule',
                body: { scheduled_at: new Date(scheduleAt).toISOString() },
              })
              setScheduling(false)
            }}
          >
            Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
