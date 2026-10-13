import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
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
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import { MessagePreview } from './MessagePreview'
import { CHANNEL_LABEL, useActivity, useActivitySummary, useMessage } from './useMessaging'

/**
 * Everything the shop has sent.
 *
 * One list for OTPs, order confirmations, campaigns and messages someone typed
 * by hand, because the question people bring here — "did this customer get it,
 * and what did it say" — does not know which of those it was.
 *
 * The four numbers at the top are a health check rather than analytics: total,
 * delivered, failed, spent, over thirty days. A failure rate that has doubled
 * shows up in one glance, which is the only reporting this screen owes anyone.
 */

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  delivered: { bg: tokens.successSurface, fg: tokens.success },
  read: { bg: tokens.successSurface, fg: tokens.success },
  sent: { bg: tokens.infoSurface, fg: tokens.info },
  queued: { bg: tokens.sand, fg: tokens.subdued },
  failed: { bg: tokens.criticalSurface, fg: tokens.critical },
  bounced: { bg: tokens.criticalSurface, fg: tokens.critical },
}

function when(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ActivityPage() {
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)

  const summary = useActivitySummary(30)
  const activity = useActivity({
    channel: channel || undefined,
    status: status || undefined,
    search: search.trim() || undefined,
    page,
    limit: 50,
  })
  const message = useMessage(openId)

  const totals = summary.data?.totals
  const attempted = (totals?.sent ?? 0) + (totals?.failed ?? 0)
  const deliveryRate = attempted > 0 ? Math.round(((totals?.delivered ?? 0) / attempted) * 100) : null

  return (
    <Box>
      <PageHeader title="Delivery log" subtitle="Every message the shop has sent" />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Sent, last 30 days', value: (totals?.total ?? 0).toLocaleString('en-IN') },
          { label: 'Delivered', value: deliveryRate === null ? '—' : `${deliveryRate}%` },
          {
            label: 'Failed',
            value: (totals?.failed ?? 0).toLocaleString('en-IN'),
            tone: (totals?.failed ?? 0) > 0 ? tokens.critical : undefined,
          },
          { label: 'Spent', value: `₹${(totals?.cost ?? 0).toFixed(2)}` },
        ].map((stat) => (
          <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ fontSize: 24, fontWeight: 600, color: stat.tone ?? tokens.inkStrong }}>
                  {stat.value}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="channel-filter">Channel</InputLabel>
          <Select
            labelId="channel-filter"
            label="Channel"
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="whatsapp">WhatsApp</MenuItem>
            <MenuItem value="sms">SMS</MenuItem>
            <MenuItem value="email">Email</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="status-filter">Status</InputLabel>
          <Select
            labelId="status-filter"
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Search by number, address or event"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.faint }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      <Card variant="outlined">
        {activity.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (activity.data?.messages.length ?? 0) === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: tokens.subdued }}>Nothing matches these filters.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>To</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(activity.data?.messages ?? []).map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(row.id)}>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>{when(row.queued_at)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13 }}>{row.customer_name || row.recipient}</Typography>
                    {row.customer_name && (
                      <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>{row.recipient}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13 }}>{row.template_name ?? row.event_key}</Typography>
                    {row.campaign_name && (
                      <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>{row.campaign_name}</Typography>
                    )}
                    {row.sent_by_name && (
                      <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>by {row.sent_by_name}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13 }}>{CHANNEL_LABEL[row.channel]}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Chip
                        size="small"
                        label={row.status}
                        sx={{
                          textTransform: 'capitalize',
                          bgcolor: STATUS_STYLE[row.status]?.bg ?? tokens.sand,
                          color: STATUS_STYLE[row.status]?.fg ?? tokens.ink,
                        }}
                      />
                      {row.simulated && (
                        <Chip
                          size="small"
                          label="simulated"
                          sx={{ bgcolor: tokens.sand, color: tokens.subdued, height: 20, fontSize: 10.5 }}
                        />
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {(activity.data?.pagination.pages ?? 1) > 1 && (
        <Stack sx={{ mt: 2, alignItems: 'center' }}>
          <Pagination
            count={activity.data?.pagination.pages ?? 1}
            page={page}
            onChange={(_event, value) => setPage(value)}
            size="small"
          />
        </Stack>
      )}

      <Drawer anchor="right" open={openId !== null} onClose={() => setOpenId(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 420 }, p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Message</Typography>
            <IconButton size="small" onClick={() => setOpenId(null)} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {message.isLoading || !message.data ? (
            <CircularProgress size={22} />
          ) : (
            <Stack spacing={2}>
              <MessagePreview
                channel={message.data.channel}
                subject={message.data.subject}
                body={message.data.body ?? ''}
                from={message.data.customer_name ?? message.data.recipient}
              />
              <Stack spacing={0.75}>
                {[
                  ['To', message.data.recipient],
                  ['Customer', message.data.customer_name ?? '—'],
                  ['Template', message.data.template_name ?? message.data.event_key],
                  ['Campaign', message.data.campaign_name ?? '—'],
                  ['Sent by', message.data.sent_by_name ?? 'Automatically'],
                  ['Provider', message.data.provider ?? '—'],
                  ['Status', message.data.status],
                  ['Queued', when(message.data.queued_at)],
                  ['Delivered', message.data.delivered_at ? when(message.data.delivered_at) : '—'],
                  ['Cost', `₹${message.data.cost.toFixed(4)}`],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 12.5, color: tokens.subdued }}>{label}</Typography>
                    <Typography sx={{ fontSize: 12.5, textAlign: 'right' }}>{value}</Typography>
                  </Stack>
                ))}
              </Stack>
              {message.data.error_message && (
                <Typography sx={{ fontSize: 12.5, color: tokens.critical }}>{message.data.error_message}</Typography>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  )
}
