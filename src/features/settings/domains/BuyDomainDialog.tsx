import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../../api/client'
import { UpgradeNotice } from '../../../components/UpgradeNotice'
import { errorMessage, isPlanError } from '../../../lib/errors'
import { formatMoneyIn } from '../../../lib/format'
import { useShop } from '../../../shop/useShop'
import { domainKeys, type DomainOffer, type DomainsResponse } from './domainTypes'

interface Contact {
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  city: string
  state: string
  zip: string
  country: string
  organization: string
}

/**
 * Buy a new domain: search, pick, confirm who registers it. It is pointed at
 * the store and connected in the same step, and renewed on the store's bill.
 */
export function BuyDomainDialog({ onClose, onDone }: { onClose(): void; onDone(message: string): void }) {
  const queryClient = useQueryClient()
  const { summary } = useShop()
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<DomainOffer | null>(null)
  const [years, setYears] = useState(1)
  const [privacy, setPrivacy] = useState(true)
  const [contact, setContact] = useState<Contact>(() => ({
    firstName: '',
    lastName: '',
    email: summary?.shop.email ?? '',
    phone: summary?.shop.phone ?? '',
    address1: '',
    city: '',
    state: '',
    zip: '',
    country: summary?.shop.country_code ?? 'IN',
    organization: summary?.shop.name ?? '',
  }))

  const results = useQuery({
    queryKey: domainKeys.search(query),
    queryFn: () => api.get<{ results: DomainOffer[] }>('/domains/search', { q: query }),
    enabled: query.length > 0,
    staleTime: 60_000,
  })

  const buy = useMutation({
    mutationFn: () => api.post<DomainsResponse>('/domains/buy', { domain: chosen!.domain, years, privacy, contact: { ...contact, organization: contact.organization || null } }),
    onSuccess: (response) => {
      queryClient.setQueryData(domainKeys.all, response)
      onDone(`${chosen!.domain} is yours — it is being connected now`)
    },
  })

  const search = (event: FormEvent) => {
    event.preventDefault()
    setChosen(null)
    setQuery(term.trim().toLowerCase())
  }

  const field = (key: keyof Contact, label: string, props: Record<string, unknown> = {}) => (
    <TextField size="small" label={label} value={contact[key]} onChange={(event) => setContact({ ...contact, [key]: event.target.value })} fullWidth {...props} />
  )
  const contactComplete = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'zip', 'country'].every((key) => contact[key as keyof Contact].trim())
  const total = chosen ? chosen.price.amount + chosen.renewal.amount * (years - 1) : 0

  return (
    <Dialog open onClose={buy.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{chosen ? `Buy ${chosen.domain}` : 'Buy a new domain'}</DialogTitle>
      {(results.isFetching || buy.isPending) && <LinearProgress sx={{ height: 2 }} />}
      <DialogContent>
        {!chosen && (
          <Stack spacing={2}>
            <form onSubmit={search}>
              <TextField
                autoFocus
                fullWidth
                placeholder="Search for a name — your brand, or what you sell"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, endAdornment: <Button type="submit" size="small" disabled={!term.trim()}>Search</Button> } }}
              />
            </form>
            {results.isError && <Alert severity="error">{errorMessage(results.error)}</Alert>}
            {results.data && (
              <List dense disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {results.data.results.map((offer) => (
                  <ListItem
                    key={offer.domain}
                    divider
                    secondaryAction={
                      offer.available ? (
                        <Button size="small" variant="outlined" onClick={() => setChosen(offer)}>
                          Buy
                        </Button>
                      ) : (
                        <Chip size="small" label="Taken" />
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: offer.available ? 'text.primary' : 'text.disabled' }}>
                            {offer.domain}
                          </Typography>
                          {offer.premium && offer.available && <Chip size="small" label="Premium" color="warning" variant="outlined" />}
                        </Stack>
                      }
                      secondary={offer.available ? `${formatMoneyIn(offer.price.amount, offer.price.currency)} first year · then ${formatMoneyIn(offer.renewal.amount, offer.renewal.currency)}/year` : 'Not available'}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {!results.data && (
              <Typography variant="body2" color="text.secondary">
                Domains bought here are set up for you — DNS, SSL and renewals — and billed with your plan. You can transfer them to another registrar at any time.
              </Typography>
            )}
          </Stack>
        )}

        {chosen && (
          <Stack spacing={2}>
            {buy.isError && (isPlanError(buy.error) ? <UpgradeNotice message={errorMessage(buy.error)} /> : <Alert severity="error">{errorMessage(buy.error)}</Alert>)}
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TextField select size="small" label="Register for" value={years} onChange={(event) => setYears(Number(event.target.value))} sx={{ width: 160 }}>
                {[1, 2, 3, 5].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value} year{value > 1 ? 's' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="h6">{formatMoneyIn(total, chosen.price.currency)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Added to your next bill · renews at {formatMoneyIn(chosen.renewal.amount, chosen.renewal.currency)}/year
                </Typography>
              </Box>
            </Stack>
            <Typography variant="subtitle2">Registrant</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              The domain’s legal owner, as registries require. {privacy ? 'Hidden from public WHOIS by privacy protection.' : ''}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {field('firstName', 'First name')}
              {field('lastName', 'Last name')}
              {field('organization', 'Business name (optional)')}
              {field('email', 'Email', { type: 'email' })}
              {field('phone', 'Phone', { type: 'tel', helperText: 'With country code, e.g. +91 98765 43210' })}
              {field('address1', 'Address')}
              {field('city', 'City')}
              {field('state', 'State / province')}
              {field('zip', 'PIN / postal code')}
              {field('country', 'Country code', { inputProps: { maxLength: 2 }, helperText: 'Two letters, e.g. IN' })}
            </Box>
            <FormControlLabel control={<Checkbox checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />} label="WHOIS privacy protection (free)" />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {chosen ? (
          <>
            <Button onClick={() => setChosen(null)} disabled={buy.isPending}>
              Back
            </Button>
            <Button variant="contained" disabled={!contactComplete || buy.isPending} onClick={() => buy.mutate()}>
              {buy.isPending ? 'Buying…' : `Buy for ${formatMoneyIn(total, chosen.price.currency)}`}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Cancel</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
