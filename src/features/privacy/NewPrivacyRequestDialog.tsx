import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../lib/errors'
import { useCustomerList, type CustomerSummary } from '../customers/useCustomers'
import { privacyKeys, TYPE_HELP, TYPE_LABEL, type PrivacyRequest, type RequestType } from './privacyTypes'

/**
 * A request that came in by email, phone or in person — or "Request customer
 * data" / "Erase personal data" for a customer, as on Shopify.
 */
export function NewPrivacyRequestDialog({ open, customer: initialCustomer, initialType, onClose, onCreated }: {
  open: boolean
  customer?: CustomerSummary | null
  initialType?: RequestType
  onClose(): void
  onCreated(id: number, message: string): void
}) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<RequestType>(initialType ?? 'access')
  const [customer, setCustomer] = useState<CustomerSummary | null>(initialCustomer ?? null)
  const [customerQuery, setCustomerQuery] = useState('')
  const query = useDebounce(customerQuery.trim(), 250)
  const customers = useCustomerList({ q: query || undefined, limit: 8 })
  const [contact, setContact] = useState('')
  const [details, setDetails] = useState('')
  const [verified, setVerified] = useState(true)

  const create = useMutation({
    mutationFn: () =>
      api.post<{ request: PrivacyRequest; verificationRequired: boolean }>('/privacy/requests', {
        type,
        customer_id: customer?.id,
        contact: customer ? undefined : contact.trim(),
        details: details.trim() || undefined,
        verified,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: privacyKeys.all })
      onCreated(response.request.id, response.verificationRequired ? 'Request created — a confirmation link was emailed to them' : 'Request created')
    },
  })

  const ready = Boolean(customer || contact.trim())
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (ready) create.mutate()
        }}
      >
        <DialogTitle>New privacy request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="What are they asking for?" value={type} onChange={(event) => setType(event.target.value as RequestType)} helperText={TYPE_HELP[type]}>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
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
              renderInput={(params) => <TextField {...params} label="Customer" helperText="Or, for someone without an account, give their email address or phone below" />}
            />
            {!customer && <TextField label="Email address or phone" value={contact} onChange={(event) => setContact(event.target.value)} slotProps={{ htmlInput: { maxLength: 191 } }} />}
            <TextField label="Details" multiline minRows={2} value={details} onChange={(event) => setDetails(event.target.value)} helperText="What they asked, in their words — kept with the request" slotProps={{ htmlInput: { maxLength: 4000 } }} />
            <FormControlLabel
              control={<Switch checked={verified} onChange={(event) => setVerified(event.target.checked)} />}
              label="I have confirmed who they are"
            />
            {!verified && (
              <Typography variant="body2" color="text.secondary">
                We will email them a link to confirm the request is theirs; nothing happens until they do.
              </Typography>
            )}
            {create.isError && <Alert severity="error">{errorMessage(create.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!ready || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create request'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
