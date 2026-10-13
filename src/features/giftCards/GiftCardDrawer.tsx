import CloseIcon from '@mui/icons-material/Close'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../api/client'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatMoneyIn, formatRelative } from '../../lib/format'
import { giftCardKeys, STATE, TRANSACTION, type GiftCard, type GiftCardTransaction } from './giftCardTypes'

type Detail = { gift_card: GiftCard & { transactions: GiftCardTransaction[] } }

/** One gift card: balance, who it is for, its history, and what staff can do to it. */
export function GiftCardDrawer({ id, canManage, onClose, onChanged }: { id: number | null; canManage: boolean; onClose: () => void; onChanged: (message: string) => void }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: giftCardKeys.one(id ?? 0), queryFn: () => api.get<Detail>(`/gift-cards/${id}`), enabled: id !== null })
  const [adjusting, setAdjusting] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [expiry, setExpiry] = useState<string | null>(null)

  const done = (message: string) => (response: Detail) => {
    queryClient.setQueryData(giftCardKeys.one(id ?? 0), response)
    void queryClient.invalidateQueries({ queryKey: ['gift-cards', 'list'] })
    onChanged(message)
  }
  const toggle = useMutation({
    mutationFn: (enable: boolean) => api.post<Detail>(`/gift-cards/${id}/${enable ? 'enable' : 'disable'}`),
    onSuccess: (response) => done(response.gift_card.status === 'enabled' ? 'Gift card re-enabled' : 'Gift card disabled')(response),
  })
  const adjust = useMutation({
    mutationFn: () => api.post<Detail>(`/gift-cards/${id}/adjust`, { amount: Number(amount), note: reason.trim() }),
    onSuccess: (response) => {
      setAdjusting(false)
      setAmount('')
      setReason('')
      done('Balance adjusted')(response)
    },
  })
  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<Detail>(`/gift-cards/${id}`, patch),
    onSuccess: (response) => {
      setExpiry(null)
      done('Gift card updated')(response)
    },
  })
  const resend = useMutation({
    mutationFn: () => api.post<{ delivery: Record<string, string> }>(`/gift-cards/${id}/resend`),
    onSuccess: () => onChanged('Gift card sent again'),
  })

  const card = detail.data?.gift_card
  return (
    <Drawer anchor="right" open={id !== null} onClose={onClose} sx={{ zIndex: (theme) => theme.zIndex.modal }} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 } } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
            {card?.masked_code ?? 'Gift card'}
          </Typography>
          {card && <Chip size="small" label={STATE[card.state].label} color={STATE[card.state].color} sx={{ mt: 0.5 }} />}
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>
      {detail.isLoading && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {detail.isError && <Alert severity="error" sx={{ m: 3 }}>{errorMessage(detail.error)}</Alert>}
      {card && (
        <Stack spacing={3} sx={{ p: 3 }}>
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Balance
              </Typography>
              <Typography variant="h4">{formatMoneyIn(card.balance, card.currency)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Initial value
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.75 }}>
                {formatMoneyIn(card.initial_value, card.currency)}
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={0.75}>
            <Row label="Expires">
              {expiry === null ? (
                <>
                  {card.expires_on ? formatDate(card.expires_on) : 'Never'}
                  {canManage && (
                    <Button size="small" sx={{ ml: 1 }} onClick={() => setExpiry(card.expires_on ?? '')}>
                      Change
                    </Button>
                  )}
                </>
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField size="small" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
                  <Button size="small" variant="contained" disabled={update.isPending} onClick={() => update.mutate({ expires_on: expiry || null })}>
                    Save
                  </Button>
                  <Button size="small" onClick={() => setExpiry(null)}>
                    Cancel
                  </Button>
                </Stack>
              )}
            </Row>
            <Row label="Customer">
              {card.customer ? (
                <Link component={RouterLink} to={`/customers/${card.customer.id}`}>
                  {card.customer.name || card.customer.email || `Customer ${card.customer.id}`}
                </Link>
              ) : (
                '—'
              )}
            </Row>
            {card.recipient && <Row label="Sent to">{[card.recipient.name, card.recipient.email, card.recipient.phone].filter(Boolean).join(' · ')}</Row>}
            {card.recipient?.message && <Row label="Message">“{card.recipient.message}”</Row>}
            <Row label="Source">
              {card.source === 'purchase' && card.order ? (
                <>
                  Bought on order{' '}
                  <Link component={RouterLink} to={`/orders/${card.order.id}`}>
                    {card.order.order_number}
                  </Link>
                </>
              ) : card.source === 'purchase' ? (
                'Bought in the store'
              ) : (
                'Issued by staff'
              )}
            </Row>
            <Row label="Issued">{formatDate(card.created_at)}</Row>
            {card.last_used_at && <Row label="Last used">{formatRelative(card.last_used_at)}</Row>}
            {card.note && <Row label="Note">{card.note}</Row>}
          </Stack>

          {canManage && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Button variant="outlined" onClick={() => setAdjusting(true)}>
                Adjust balance
              </Button>
              {(card.customer || card.recipient) && (
                <Button variant="outlined" disabled={resend.isPending} onClick={() => resend.mutate()}>
                  Send again
                </Button>
              )}
              <Button color={card.status === 'enabled' ? 'error' : 'primary'} variant="outlined" disabled={toggle.isPending} onClick={() => toggle.mutate(card.status !== 'enabled')}>
                {card.status === 'enabled' ? 'Disable' : 'Re-enable'}
              </Button>
            </Stack>
          )}
          {[toggle.error, update.error, resend.error].filter(Boolean).map((error, index) => (
            <Alert key={index} severity="error">
              {errorMessage(error)}
            </Alert>
          ))}

          <Divider />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              History
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>What</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {card.transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(transaction.created_at)}</TableCell>
                    <TableCell>
                      {TRANSACTION[transaction.kind]}
                      {transaction.order && (
                        <>
                          {' · '}
                          <Link component={RouterLink} to={`/orders/${transaction.order.id}`}>
                            {transaction.order.order_number}
                          </Link>
                        </>
                      )}
                      {transaction.note && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {transaction.note}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: transaction.amount < 0 ? 'text.primary' : 'success.main' }}>
                      {transaction.amount > 0 ? '+' : '−'}
                      {formatMoneyIn(Math.abs(transaction.amount), card.currency)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatMoneyIn(transaction.balance_after, card.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      )}

      <Dialog open={adjusting} onClose={() => setAdjusting(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust balance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              A positive amount adds to the balance, a negative one takes from it. The reason is kept in the card’s history.
            </Typography>
            <TextField label="Amount" autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.-]/g, ''))} helperText={card ? `Balance now ${formatMoneyIn(card.balance, card.currency)}` : undefined} />
            <TextField label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
            {adjust.isError && <Alert severity="error">{errorMessage(adjust.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjusting(false)}>Cancel</Button>
          <Button variant="contained" disabled={!Number(amount) || !reason.trim() || adjust.isPending} onClick={() => adjust.mutate()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ flex: 1 }}>
        {children}
      </Typography>
    </Stack>
  )
}
