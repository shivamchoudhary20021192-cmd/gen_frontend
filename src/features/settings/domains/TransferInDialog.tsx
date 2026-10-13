import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Step, StepContent, StepLabel, Stepper, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'
import { formatMoneyIn } from '../../../lib/format'
import { domainKeys, type Domain, type DomainsResponse } from './domainTypes'

interface TransferQuote {
  domain: string
  eligible: boolean
  reason: string | null
  price: { amount: number; currency: string } | null
  registrar: string
  adds_years: number
}

/**
 * Shopify's "Transfer to Shopify": moves the registration of a domain that is
 * already connected (so the store never goes down) from the merchant's current
 * provider to the platform, with the transfer code from that provider.
 */
export function TransferInDialog({ domain, onClose, onDone }: { domain: Domain; onClose: () => void; onDone: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [privacy, setPrivacy] = useState(true)
  const quote = useQuery({ queryKey: [...domainKeys.one(domain.id), 'transfer'], queryFn: () => api.get<TransferQuote>(`/domains/${domain.id}/transfer`) })
  const start = useMutation({
    mutationFn: () => api.post<DomainsResponse>(`/domains/${domain.id}/transfer`, { auth_code: code.trim(), privacy }),
    onSuccess: (response) => {
      queryClient.setQueryData(domainKeys.all, response)
      onDone(`Transfer of ${quote.data?.domain ?? domain.hostname} started — it usually completes within 5–7 days`)
    },
  })
  const offer = quote.data
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) start.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Transfer {offer?.domain ?? domain.hostname} here</DialogTitle>
        <DialogContent>
          {quote.isLoading && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {quote.isError && <Alert severity="error">{errorMessage(quote.error)}</Alert>}
          {offer && !offer.eligible && <Alert severity="warning">{offer.reason ?? 'This domain cannot be transferred here.'}</Alert>}
          {offer?.eligible && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Your domain already points to your store, so nothing goes down. Once the transfer completes, renewals, auto-renew and the transfer code are handled here — your DNS stays where it is.
              </Typography>
              <Stepper orientation="vertical" activeStep={-1} sx={{ '& .MuiStepContent-root': { borderColor: 'divider' } }}>
                <Step expanded>
                  <StepLabel>Unlock the domain</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary">
                      At your current provider, turn off the transfer lock (sometimes called registrar lock or domain lock).
                    </Typography>
                  </StepContent>
                </Step>
                <Step expanded>
                  <StepLabel>Get the transfer code</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary">
                      Ask the same provider for the authorization code (also called the EPP or auth code). Some send it by email.
                    </Typography>
                  </StepContent>
                </Step>
                <Step expanded>
                  <StepLabel>Enter it here</StepLabel>
                  <StepContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                      <TextField size="small" label="Transfer code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" slotProps={{ htmlInput: { spellCheck: false, maxLength: 64 } }} />
                      <FormControlLabel control={<Switch checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />} label="Keep my contact details private in the public WHOIS" />
                    </Stack>
                  </StepContent>
                </Step>
              </Stepper>
              {offer.price && (
                <Alert severity="info" variant="outlined">
                  {formatMoneyIn(offer.price.amount, offer.price.currency)} — adds {offer.adds_years} year to the registration. It is added to your next bill once the transfer completes; if it does not go through, nothing is charged.
                </Alert>
              )}
              {start.isError && <Alert severity="error">{errorMessage(start.error)}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          {offer?.eligible && (
            <Button type="submit" variant="contained" disabled={!code.trim() || start.isPending}>
              {start.isPending ? 'Starting…' : 'Start transfer'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}
