import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  Typography,
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import {
  CHANNEL_LABEL,
  useCampaigns,
  useSaveCampaign,
  useTemplates,
  type Channel,
} from './useMessaging'

/**
 * Every bulk send, past and planned.
 *
 * The progress column is the point of this screen. A campaign is the one thing
 * in the admin that keeps working after you leave the page, so the list has to
 * answer "is it moving, and is it going well" without opening anything — which
 * is delivered over attempted, drawn as a bar, with failures called out in red
 * rather than averaged into a percentage.
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

function when(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')

  const campaigns = useCampaigns(status ? { status } : {})
  const templates = useTemplates({ channel })
  const save = useSaveCampaign()

  const rows = campaigns.data?.campaigns ?? []
  const sendable = (templates.data?.templates ?? []).filter(
    (template) => template.can_send && template.category !== 'authentication',
  )

  return (
    <Box>
      <PageHeader
        title="Campaigns"
        subtitle={`${rows.length} campaign${rows.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            New campaign
          </Button>
        }
      />

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="status-filter">Status</InputLabel>
          <Select
            labelId="status-filter"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {Object.entries(STATUS_STYLE).map(([value, style]) => (
              <MenuItem key={value} value={value}>
                {style.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Card variant="outlined">
        {campaigns.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: tokens.subdued }}>
              Nothing sent yet. A campaign is one message, one audience, one schedule.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Campaign</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>When</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((campaign) => {
                const style = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft
                const attempted = campaign.sent_count + campaign.failed_count + campaign.skipped_count
                const percent =
                  campaign.total_recipients > 0 ? Math.round((attempted / campaign.total_recipients) * 100) : 0

                return (
                  <TableRow
                    key={campaign.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/notifications/campaigns/${campaign.id}`)}
                  >
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.inkStrong }}>
                        {campaign.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.faint }}>
                        {campaign.template_name ?? 'No template yet'}
                        {campaign.segment_name ? ` · ${campaign.segment_name}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13 }}>{CHANNEL_LABEL[campaign.channel]}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={style.label} sx={{ bgcolor: style.bg, color: style.fg }} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>
                        {when(campaign.completed_at ?? campaign.started_at ?? campaign.scheduled_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {campaign.total_recipients === 0 ? (
                        <Typography sx={{ fontSize: 12.5, color: tokens.faint }}>Not started</Typography>
                      ) : (
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={percent}
                            sx={{ height: 5, borderRadius: 3, mb: 0.5 }}
                          />
                          <Typography sx={{ fontSize: 12, color: tokens.subdued }}>
                            {campaign.delivered_count.toLocaleString('en-IN')} delivered of{' '}
                            {campaign.total_recipients.toLocaleString('en-IN')}
                            {campaign.failed_count > 0 && (
                              <Box component="span" sx={{ color: tokens.critical }}>
                                {' '}
                                · {campaign.failed_count} failed
                              </Box>
                            )}
                            {campaign.skipped_count > 0 && (
                              <Box component="span" sx={{ color: tokens.warning }}>
                                {' '}
                                · {campaign.skipped_count} skipped
                              </Box>
                            )}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              placeholder="September edit — WhatsApp"
              size="small"
              fullWidth
              value={name}
              onChange={(event) => setName(event.target.value)}
              helperText="Only staff see this."
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="new-channel">Channel</InputLabel>
              <Select
                labelId="new-channel"
                label="Channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
              >
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="email">Email</MenuItem>
              </Select>
            </FormControl>
            {sendable.length === 0 && (
              <Typography sx={{ fontSize: 12.5, color: tokens.warning }}>
                No {CHANNEL_LABEL[channel]} template is ready to send yet. You can still create the campaign and
                choose one later.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || save.isPending}
            onClick={async () => {
              const campaign = await save.mutateAsync({
                id: null,
                input: { name: name.trim(), channel, audience_type: 'segment' },
              })
              setCreating(false)
              setName('')
              navigate(`/notifications/campaigns/${campaign.id}`)
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
