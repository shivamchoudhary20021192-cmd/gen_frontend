import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../lib/errors'
import { formatMoneyIn } from '../../lib/format'
import { useShop } from '../../shop/useShop'
import { useCustomerList, type CustomerSummary } from '../customers/useCustomers'
import { giftCardKeys, type GiftCard } from './giftCardTypes'

interface Issued {
  gift_card: GiftCard
  code: string
  delivery: Record<string, string> | null
}

/**
 * Issue a gift card: an amount, an optional code and expiry, who it is for.
 * After issuing, the full code is shown — the one time it ever is.
 */
export function IssueGiftCardDialog({ onClose, onIssued }: { onClose: () => void; onIssued: (card: GiftCard) => void }) {
  const queryClient = useQueryClient()
  const shop = useShop()
  const currency = shop.summary?.shop.currency ?? 'INR'
  const [value, setValue] = useState('')
  const [code, setCode] = useState('')
  const [expires, setExpires] = useState('')
  const [note, setNote] = useState('')
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const debounced = useDebounce(customerQuery, 300)
  const customers = useCustomerList({ q: debounced || undefined, limit: 10 })
  const [toSomeoneElse, setToSomeoneElse] = useState(false)
  const [recipient, setRecipient] = useState({ name: '', email: '', phone: '', message: '' })
  const [notify, setNotify] = useState(true)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  const issue = useMutation({
    mutationFn: () =>
      api.post<Issued>('/gift-cards', {
        value: Number(value),
        code: code.trim() || null,
        expires_on: expires || null,
        customer_id: customer?.id ?? null,
        note: note.trim() || null,
        recipient: toSomeoneElse ? { name: recipient.name || null, email: recipient.email || null, phone: recipient.phone || null, message: recipient.message || null } : null,
        notify,
      }),
    onSuccess: (response) => {
      setIssued(response)
      void queryClient.invalidateQueries({ queryKey: giftCardKeys.all })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (Number(value) > 0) issue.mutate()
  }

  if (issued) {
    const sent = issued.delivery && Object.entries(issued.delivery).filter(([, outcome]) => outcome === 'sent').map(([channel]) => channel)
    return (
      <Dialog open onClose={() => onIssued(issued.gift_card)} maxWidth="xs" fullWidth>
        <DialogTitle>Gift card issued</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {formatMoneyIn(issued.gift_card.initial_value, issued.gift_card.currency)} gift card. Copy the code now — for security it is not shown again; staff only ever see its last four characters.
            </Typography>
            <Box sx={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600, letterSpacing: 2, p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>{issued.code}</Box>
            <Button
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                void navigator.clipboard?.writeText(issued.code)
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </Button>
            {sent && sent.length > 0 && <Alert severity="success">Sent by {sent.join(', ')}.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => onIssued(issued.gift_card)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Issue gift card</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Initial value"
                required
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ''))}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { inputMode: 'decimal' } }}
                sx={{ flex: 1 }}
              />
              <TextField label="Expires on" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} helperText="Leave empty for no expiry" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            </Stack>
            <TextField label="Code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} helperText="Leave empty to generate a secure 16-character code" slotProps={{ htmlInput: { maxLength: 24, spellCheck: false } }} />
            <Autocomplete
              options={customers.data?.customers ?? []}
              value={customer}
              onChange={(_event, next) => setCustomer(next)}
              inputValue={customerQuery}
              onInputChange={(_event, next) => setCustomerQuery(next)}
              getOptionLabel={(option) => `${option.name}${option.email ? ` · ${option.email}` : ''}`}
              isOptionEqualToValue={(option, selected) => option.id === selected.id}
              filterOptions={(options) => options}
              loading={customers.isFetching}
              renderInput={(params) => <TextField {...params} label="Customer" helperText="Optional — the card shows on their record and is sent to them" />}
            />
            <FormControlLabel control={<Switch checked={toSomeoneElse} onChange={(event) => setToSomeoneElse(event.target.checked)} />} label="Send it to someone else as a gift" />
            <Collapse in={toSomeoneElse} unmountOnExit>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Recipient name" value={recipient.name} onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} sx={{ flex: 1 }} />
                  <TextField label="Recipient email" type="email" value={recipient.email} onChange={(event) => setRecipient({ ...recipient, email: event.target.value })} sx={{ flex: 1 }} />
                </Stack>
                <TextField label="Recipient phone" value={recipient.phone} onChange={(event) => setRecipient({ ...recipient, phone: event.target.value })} />
                <TextField label="Message" multiline minRows={2} value={recipient.message} onChange={(event) => setRecipient({ ...recipient, message: event.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
              </Stack>
            </Collapse>
            <TextField label="Internal note" value={note} onChange={(event) => setNote(event.target.value)} helperText="Only staff see this" slotProps={{ htmlInput: { maxLength: 500 } }} />
            <Tooltip title={customer || toSomeoneElse ? '' : 'Choose a customer or a recipient to send it to'}>
              <FormControlLabel control={<Switch checked={notify} disabled={!customer && !toSomeoneElse} onChange={(event) => setNotify(event.target.checked)} />} label="Send the gift card by email, SMS and WhatsApp" />
            </Tooltip>
            {issue.isError && <Alert severity="error">{errorMessage(issue.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!(Number(value) > 0) || issue.isPending}>
            {issue.isPending ? 'Issuing…' : 'Issue gift card'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
