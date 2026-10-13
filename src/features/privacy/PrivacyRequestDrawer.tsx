import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../api/client'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage } from '../../lib/errors'
import { countryName, formatBytes, formatDate, formatRelative } from '../../lib/format'
import { privacyKeys, SOURCE_LABEL, STATUS, TYPE_HELP, TYPE_LABEL, type PrivacyRequest, type RequestDetail } from './privacyTypes'

type Note = { action: 'complete' | 'reject'; text: string }

/** One privacy request: who asked, about whom, the deadline, and the next thing to do. */
export function PrivacyRequestDrawer({ id, canHandle, onClose, onChanged }: { id: number | null; canHandle: boolean; onClose(): void; onChanged(message: string): void }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: privacyKeys.request(id ?? 0), queryFn: () => api.get<RequestDetail>(`/privacy/requests/${id}`), enabled: id !== null })
  const [note, setNote] = useState<Note | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: privacyKeys.all })
    onChanged(message)
  }
  const act = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: Record<string, unknown> }) => api.post<{ request: PrivacyRequest }>(`/privacy/requests/${id}/${action}`, body ?? {}),
    onSuccess: (_response, { action }) => {
      setNote(null)
      setConfirmErase(false)
      const messages: Record<string, string> = {
        verify: 'Marked as verified — the deadline is running',
        start: 'Marked as in progress',
        export: 'Data exported',
        'send-export': 'Download link sent — request completed',
        erase: 'Erasure scheduled',
        'cancel-erasure': 'Erasure cancelled',
        'withdraw-consent': 'Marketing consent withdrawn — request completed',
        complete: 'Request completed',
        reject: 'Request refused',
      }
      void refresh(messages[action] ?? 'Updated')
    },
  })

  const download = async () => {
    if (!id || !data) return
    setDownloading(true)
    try {
      const file = await api.get<unknown>(`/privacy/requests/${id}/export`)
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${data.request.reference.toLowerCase()}-data.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const data = detail.data
  const request = data?.request
  const open = request ? ['received', 'in_progress'].includes(request.status) : false
  const wantsData = request ? ['access', 'portability'].includes(request.type) : false
  const hasExport = Boolean(data?.exports.some((entry) => new Date(entry.expires_at).getTime() > detail.dataUpdatedAt))

  return (
    <Drawer anchor="right" open={id !== null} onClose={onClose} sx={{ zIndex: (theme) => theme.zIndex.modal }} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 } } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>{request?.reference ?? 'Privacy request'}</Typography>
          {request && <Typography variant="body2" color="text.secondary">{TYPE_LABEL[request.type]} · {SOURCE_LABEL[request.source]}</Typography>}
        </Box>
        {request && <Chip label={STATUS[request.status].label} color={STATUS[request.status].color} sx={{ mr: 1 }} />}
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </Stack>

      {detail.isLoading && <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>}
      {detail.isError && <Alert severity="error" sx={{ m: 3 }}>{errorMessage(detail.error)}</Alert>}

      {request && data && (
        <Box sx={{ p: 3, overflowY: 'auto' }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">{TYPE_HELP[request.type]}</Typography>

            {request.overdue && <Alert severity="error">This request is past its deadline ({formatDate(request.due_at)}). Answer it as soon as you can.</Alert>}
            {request.status === 'verifying' && (
              <Alert severity="info">
                Waiting for the requester to click the confirmation link we emailed them, so no one can ask for someone else’s data. If you have confirmed who they are another way, mark it verified.
              </Alert>
            )}
            {request.status === 'scheduled' && (
              <Alert severity="warning">
                The erasure runs on <strong>{formatDate(request.scheduled_for)}</strong>. Until then you can cancel it. Orders and invoices are kept without tracking data, because tax law requires them.
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 1, columnGap: 2 }}>
              <Typography variant="body2" color="text.secondary">From</Typography>
              <Typography variant="body2">{request.contact}{request.requester_country ? ` · ${countryName(request.requester_country)}` : ''}</Typography>
              <Typography variant="body2" color="text.secondary">Customer</Typography>
              <Typography variant="body2">
                {request.customer ? (
                  <>
                    <Link component={RouterLink} to={`/customers/${request.customer.id}`}>{request.customer.name || request.customer.email || `Customer ${request.customer.id}`}</Link>
                    {request.customer.erased && <Chip size="small" label="Erased" sx={{ ml: 1 }} />}
                  </>
                ) : (
                  'No customer record — guest orders, messages or subscriptions under this address are included'
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">Their data</Typography>
              <Typography variant="body2">
                {data.subject.orders} order{data.subject.orders === 1 ? '' : 's'}
                {data.subject.last_order_at ? `, last ${formatDate(data.subject.last_order_at)}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">Received</Typography>
              <Typography variant="body2">{formatDate(request.created_at)} ({formatRelative(request.created_at)})</Typography>
              <Typography variant="body2" color="text.secondary">Verified</Typography>
              <Typography variant="body2">{request.verified_at ? formatDate(request.verified_at) : 'Not yet'}</Typography>
              <Typography variant="body2" color="text.secondary">Respond by</Typography>
              <Typography variant="body2" color={request.overdue ? 'error' : 'text.primary'}>{request.due_at ? formatDate(request.due_at) : '—'}</Typography>
              {request.completed_at && (
                <>
                  <Typography variant="body2" color="text.secondary">Closed</Typography>
                  <Typography variant="body2">{formatDate(request.completed_at)}</Typography>
                </>
              )}
            </Box>

            {request.details && (
              <Box>
                <Typography variant="subtitle2">What they said</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{request.details}</Typography>
              </Box>
            )}

            {request.outcome_note && (
              <Box>
                <Typography variant="subtitle2">Outcome</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} data-outcome>{request.outcome_note}</Typography>
              </Box>
            )}

            {data.exports.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Data exports</Typography>
                {data.exports.map((entry) => (
                  <Typography key={entry.id} variant="body2" color="text.secondary">
                    {formatDate(entry.created_at)} · {formatBytes(entry.size_bytes)} · deleted {formatDate(entry.expires_at)}
                    {entry.sent_to_customer ? ` · sent to the requester${entry.downloaded_at ? `, downloaded ${formatRelative(entry.downloaded_at)}` : ''}` : ''}
                  </Typography>
                ))}
              </Box>
            )}

            {act.isError && <Alert severity="error">{errorMessage(act.error)}</Alert>}

            {canHandle && (
              <>
                <Divider />
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} data-request-actions>
                  {request.status === 'verifying' && (
                    <Button variant="outlined" onClick={() => act.mutate({ action: 'verify' })} disabled={act.isPending}>Mark as verified</Button>
                  )}
                  {request.status === 'received' && !wantsData && request.type !== 'erasure' && request.type !== 'withdraw_consent' && (
                    <Button variant="outlined" onClick={() => act.mutate({ action: 'start' })} disabled={act.isPending}>Start</Button>
                  )}
                  {open && wantsData && (
                    <Button variant={hasExport ? 'outlined' : 'contained'} onClick={() => act.mutate({ action: 'export' })} disabled={act.isPending}>
                      {hasExport ? 'Export again' : 'Export their data'}
                    </Button>
                  )}
                  {hasExport && (
                    <Button variant="outlined" startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />} onClick={download} disabled={downloading}>Download</Button>
                  )}
                  {open && wantsData && hasExport && (
                    <Button variant="contained" onClick={() => act.mutate({ action: 'send-export' })} disabled={act.isPending}>Send to requester</Button>
                  )}
                  {open && request.type === 'erasure' && (
                    <Button variant="contained" color="error" onClick={() => setConfirmErase(true)} disabled={act.isPending}>Schedule erasure</Button>
                  )}
                  {request.status === 'scheduled' && (
                    <Button variant="outlined" onClick={() => act.mutate({ action: 'cancel-erasure' })} disabled={act.isPending}>Cancel erasure</Button>
                  )}
                  {open && request.type === 'withdraw_consent' && (
                    <Button variant="contained" onClick={() => act.mutate({ action: 'withdraw-consent' })} disabled={act.isPending}>Withdraw marketing consent</Button>
                  )}
                  {open && (
                    <Button variant={['correction', 'grievance'].includes(request.type) ? 'contained' : 'text'} onClick={() => setNote({ action: 'complete', text: '' })} disabled={act.isPending}>Complete</Button>
                  )}
                  {!['completed', 'rejected', 'cancelled'].includes(request.status) && (
                    <Button color="error" onClick={() => setNote({ action: 'reject', text: '' })} disabled={act.isPending}>Refuse</Button>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      )}

      <Dialog open={note !== null} onClose={() => setNote(null)} fullWidth maxWidth="sm">
        <DialogTitle>{note?.action === 'reject' ? 'Refuse this request' : 'Complete this request'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {note?.action === 'reject'
              ? 'Say why — for example, you could not confirm who they are, or the law requires you to keep the data. The requester is emailed this, with how to complain.'
              : 'Say what you did. The requester is emailed this.'}
          </Typography>
          <TextField autoFocus fullWidth multiline minRows={3} label={note?.action === 'reject' ? 'Reason' : 'What was done'} value={note?.text ?? ''} onChange={(event) => note && setNote({ ...note, text: event.target.value })} slotProps={{ htmlInput: { maxLength: 4000 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNote(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={note?.action === 'reject' ? 'error' : 'primary'}
            disabled={act.isPending || (note?.action === 'reject' && !note.text.trim())}
            onClick={() => note && act.mutate({ action: note.action, body: { note: note.text.trim() || undefined } })}
          >
            {note?.action === 'reject' ? 'Refuse request' : 'Complete request'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmErase}
        title="Schedule erasure?"
        destructive
        busy={act.isPending}
        confirmLabel="Schedule erasure"
        body={
          <>
            Their personal data will be erased on <strong>{formatDate(data?.erasure_would_run_at)}</strong> — after the grace period, and after the returns and chargeback window of their last order. You can cancel until then.
            <br />
            <br />
            Addresses, sessions, wishlists, subscriptions, quiz answers and messages are deleted; reviews and comments are anonymised; orders and invoices are kept without tracking data, because tax law requires them. Apps you have installed are told to erase what they hold.
          </>
        }
        onConfirm={() => act.mutate({ action: 'erase' })}
        onClose={() => setConfirmErase(false)}
      />
    </Drawer>
  )
}
