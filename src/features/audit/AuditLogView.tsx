import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate, formatRelative } from '../../lib/format'

export interface AuditEntry {
  id: number
  shop: { id: number; handle: string | null; name: string | null } | null
  actor: { type: string; id: number | null; label: string | null }
  action: string
  entity: { type: string; id: number | null } | null
  summary: string | null
  changes: unknown
  context: unknown
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditPage {
  entries: AuditEntry[]
  pagination: { page: number; limit: number; has_next: boolean; has_prev: boolean }
}

export type AuditQuery = Record<string, string | number | undefined>

const ACTORS = [
  { value: '', label: 'Anyone' },
  { value: 'admin', label: 'Staff' },
  { value: 'customer', label: 'Customers' },
  { value: 'system', label: 'System' },
  { value: 'webhook', label: 'Webhooks' },
  { value: 'job', label: 'Background jobs' },
]

const PERIODS = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

const ACTOR_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'info' | 'warning'> = { admin: 'primary', customer: 'secondary', system: 'default', webhook: 'info', job: 'default' }

/** "product.updated" → "Product updated". */
function actionLabel(action: string): string {
  const text = action.replace(/^platform\./, 'Platform · ').replace(/[._]/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A change set as rows: { field: { from, to } } or { field: value }. */
function changeRows(changes: unknown): { field: string; from: unknown; to: unknown }[] | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null
  return Object.entries(changes as Record<string, unknown>).map(([field, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && ('from' in value || 'to' in value)) {
      const pair = value as { from?: unknown; to?: unknown }
      return { field, from: pair.from, to: pair.to }
    }
    return { field, from: undefined, to: value }
  })
}

const show = (value: unknown) => (value === undefined ? '—' : value === null ? 'empty' : typeof value === 'object' ? JSON.stringify(value) : String(value))

/**
 * The audit trail: who did what, when, from where. The store's Settings →
 * Audit log and the operators' console use the same view; the console also
 * shows which store each entry belongs to.
 */
export function AuditLogView({
  queryKey,
  fetchPage,
  areas,
  showShop = false,
  extraFilters,
}: {
  queryKey: readonly unknown[]
  fetchPage(query: AuditQuery): Promise<AuditPage>
  areas?: { area: string; total: number }[]
  showShop?: boolean
  extraFilters?: AuditQuery
}) {
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [actor, setActor] = useState('')
  // The start of the period is worked out when it is picked, not on every render.
  const [period, setPeriod] = useState<{ value: string; since?: string }>({ value: '' })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const search = useDebounce(q, 300)
  const query: AuditQuery = { ...extraFilters, q: search || undefined, action: area || undefined, actor_type: actor || undefined, since: period.since, page, limit: 50 }

  const entries = useQuery({ queryKey: [...queryKey, query], queryFn: () => fetchPage(query), placeholderData: keepPreviousData })
  const list = entries.data?.entries ?? []
  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search what happened or who did it" value={q} onChange={(event) => reset(setQ)(event.target.value)} sx={{ flex: 1 }} />
        <TextField select size="small" label="Area" value={area} onChange={(event) => reset(setArea)(event.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="">Everything</MenuItem>
          {(areas ?? []).map((entry) => (
            <MenuItem key={entry.area} value={entry.area}>
              {actionLabel(entry.area)} ({entry.total})
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Who" value={actor} onChange={(event) => reset(setActor)(event.target.value)} sx={{ minWidth: 150 }}>
          {ACTORS.map((entry) => (
            <MenuItem key={entry.value} value={entry.value}>
              {entry.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="When"
          value={period.value}
          onChange={(event) => {
            const days = event.target.value
            // Rounded to the hour so the query key stays stable while the page is open.
            reset(setPeriod)({ value: days, since: days ? new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - Number(days) * 86_400_000).toISOString() : undefined })
          }}
          sx={{ minWidth: 150 }}
        >
          {PERIODS.map((entry) => (
            <MenuItem key={entry.value} value={entry.value}>
              {entry.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', overflow: 'hidden' }}>
        {entries.isFetching && <LinearProgress sx={{ height: 2 }} />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 150 }}>When</TableCell>
              <TableCell>What happened</TableCell>
              <TableCell sx={{ width: 200 }}>Who</TableCell>
              {showShop && <TableCell sx={{ width: 180 }}>Store</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((entry) => (
              <TableRow key={entry.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(entry)}>
                <TableCell>
                  <Tooltip title={formatDate(entry.created_at)}>
                    <span>{formatRelative(entry.created_at)}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{entry.summary ?? actionLabel(entry.action)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {entry.action}
                    {entry.entity ? ` · ${entry.entity.type}${entry.entity.id ? ` #${entry.entity.id}` : ''}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Chip size="small" label={ACTORS.find((item) => item.value === entry.actor.type)?.label.replace(/s$/, '') ?? entry.actor.type} color={ACTOR_COLOR[entry.actor.type] ?? 'default'} variant="outlined" />
                    <Typography variant="body2" noWrap>
                      {entry.actor.label ?? ''}
                    </Typography>
                  </Stack>
                </TableCell>
                {showShop && <TableCell>{entry.shop ? (entry.shop.name ?? entry.shop.handle) : <Typography variant="caption">Platform</Typography>}</TableCell>}
              </TableRow>
            ))}
            {!entries.isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={showShop ? 4 : 3}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Nothing recorded{q || area || actor || period.value ? ' that matches' : ' yet'}.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 1.5 }}>
        <Button size="small" disabled={!entries.data?.pagination.has_prev} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          Newer
        </Button>
        <Button size="small" disabled={!entries.data?.pagination.has_next} onClick={() => setPage((value) => value + 1)}>
          Older
        </Button>
      </Stack>

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        {open && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              {open.summary ?? actionLabel(open.action)}
              <IconButton aria-label="Close" onClick={() => setOpen(null)} sx={{ position: 'absolute', right: 12, top: 12 }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 1, columnGap: 2, mb: 2, fontSize: 14 }}>
                <Typography variant="body2" color="text.secondary">When</Typography>
                <Typography variant="body2">{formatDate(open.created_at)}</Typography>
                <Typography variant="body2" color="text.secondary">Who</Typography>
                <Typography variant="body2">
                  {open.actor.label ?? '—'} ({open.actor.type}
                  {open.actor.id ? ` #${open.actor.id}` : ''})
                </Typography>
                <Typography variant="body2" color="text.secondary">Action</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{open.action}</Typography>
                {open.entity && (
                  <>
                    <Typography variant="body2" color="text.secondary">Record</Typography>
                    <Typography variant="body2">
                      {open.entity.type}
                      {open.entity.id ? ` #${open.entity.id}` : ''}
                    </Typography>
                  </>
                )}
                {showShop && (
                  <>
                    <Typography variant="body2" color="text.secondary">Store</Typography>
                    <Typography variant="body2">{open.shop ? `${open.shop.name ?? ''} (${open.shop.handle ?? open.shop.id})` : 'Platform'}</Typography>
                  </>
                )}
                {open.ip && (
                  <>
                    <Typography variant="body2" color="text.secondary">From</Typography>
                    <Typography variant="body2">
                      {open.ip}
                      {open.user_agent ? ` · ${open.user_agent}` : ''}
                    </Typography>
                  </>
                )}
              </Box>

              {(() => {
                const rows = changeRows(open.changes)
                if (rows && rows.length) {
                  return (
                    <>
                      <Typography variant="subtitle2" gutterBottom>
                        Changes
                      </Typography>
                      <Table size="small" sx={{ mb: 2 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Field</TableCell>
                            <TableCell>Before</TableCell>
                            <TableCell>After</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.field}>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.field}</TableCell>
                              <TableCell sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>{show(row.from)}</TableCell>
                              <TableCell sx={{ wordBreak: 'break-word' }}>{show(row.to)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )
                }
                return null
              })()}

              {Boolean(open.context) && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Details
                  </Typography>
                  <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, overflow: 'auto', maxHeight: 280 }}>
                    {JSON.stringify(open.context, null, 2)}
                  </Box>
                </>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  )
}
