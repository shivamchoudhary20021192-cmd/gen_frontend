import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useDebounce } from '../../hooks/useDebounce'
import { formatRelative } from '../../lib/format'
import { consoleKeys, type ConsoleEmail } from './consoleTypes'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = { sent: 'success', pending: 'warning', failed: 'error' }

/**
 * The platform's own email to merchants and staff — signup, invitations,
 * password resets, billing notices. In development (PLATFORM_EMAIL_PROVIDER=
 * log) this is where those emails are read; in production, whether each one
 * was accepted. A reset or invitation link is never shown once delivered for
 * real.
 */
export function ConsoleEmailsPage() {
  const [to, setTo] = useState('')
  const [template, setTemplate] = useState('')
  const [open, setOpen] = useState<ConsoleEmail | null>(null)
  const query = { to: useDebounce(to, 300) || undefined, template: useDebounce(template, 300) || undefined, limit: 100 }
  const emails = useQuery({ queryKey: consoleKeys.emails(query), queryFn: () => platformApi.get<{ emails: ConsoleEmail[] }>('/emails', query), placeholderData: (previous) => previous })
  const list = emails.data?.emails ?? []

  return (
    <>
      <PageHeader title="Platform email" subtitle="The most recent 100." />
      <SectionCard
        title="Outbox"
        actions={
          <Stack direction="row" spacing={1}>
            <TextField size="small" placeholder="To address" value={to} onChange={(event) => setTo(event.target.value)} />
            <TextField size="small" placeholder="Template" value={template} onChange={(event) => setTemplate(event.target.value)} sx={{ width: 150 }} />
          </Stack>
        }
        flush
      >
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            Nothing sent yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>To</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Queued</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((email) => (
                <TableRow key={email.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(email)}>
                  <TableCell>{email.to}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" noWrap>
                      {email.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{email.template}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={email.status} color={STATUS_COLOR[email.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{formatRelative(email.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {open?.subject}
            </Typography>
            <Typography variant="caption">
              To {open?.to} · {open?.template} · {open?.provider ?? 'not sent yet'} · {open?.attempts} attempt{open?.attempts === 1 ? '' : 's'}
            </Typography>
          </Box>
          <IconButton onClick={() => setOpen(null)} size="small" aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {open?.error && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {open.error}
            </Typography>
          )}
          {open?.body ? (
            <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, m: 0 }}>
              {open.body}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              This email carried a one-time link, so its body is not kept after delivery.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
