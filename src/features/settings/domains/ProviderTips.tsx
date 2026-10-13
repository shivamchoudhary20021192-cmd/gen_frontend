import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material'
import { useState } from 'react'

/** Where each provider keeps DNS, and the one thing that trips people up there. */
const PROVIDERS: { key: string; name: string; steps: string[]; watch?: string }[] = [
  {
    key: 'godaddy',
    name: 'GoDaddy',
    steps: ['Open My Products → your domain → DNS.', 'Edit the existing A record for "@" (do not add a second one) and add the CNAME for "www".', 'Save. GoDaddy usually updates within an hour.'],
    watch: 'GoDaddy creates a parking A record and a "www" CNAME to "@" by default — replace them rather than adding next to them.',
  },
  {
    key: 'namecheap',
    name: 'Namecheap',
    steps: ['Domain List → Manage → Advanced DNS.', 'Delete the "URL Redirect Record" and the parking CNAME if present.', 'Add the records with TTL "Automatic".'],
  },
  {
    key: 'cloudflare',
    name: 'Cloudflare',
    steps: ['Your site → DNS → Records.', 'Add the records, and set Proxy status to "DNS only" (grey cloud).', 'For the domain itself (@), Cloudflare flattens the CNAME automatically.'],
    watch: 'An orange-cloud (proxied) record stops your store’s certificate from being issued.',
  },
  {
    key: 'google',
    name: 'Squarespace Domains (formerly Google Domains)',
    steps: ['Domains → your domain → DNS → Custom records.', 'Remove the Squarespace default records if the domain pointed to a Squarespace site.', 'Add the records.'],
  },
  {
    key: 'hostinger',
    name: 'Hostinger',
    steps: ['Domains → your domain → DNS / Nameservers → DNS records.', 'Delete the existing A record for "@" and the CNAME for "www".', 'Add the records.'],
  },
  {
    key: 'bigrock',
    name: 'BigRock / ResellerClub',
    steps: ['My Orders → your domain → DNS Management.', 'Add the A record and the CNAME record in their tabs.', 'Changes can take up to 24 hours at BigRock.'],
  },
  {
    key: 'other',
    name: 'Another provider',
    steps: ['Sign in where you bought the domain and open its DNS settings (sometimes "Zone editor" or "Name server management").', 'Add the records exactly as shown. "@" means the domain itself.', 'Remove any other A or AAAA records for the same name.'],
  },
]

export function ProviderTips() {
  const [key, setKey] = useState('godaddy')
  const provider = PROVIDERS.find((entry) => entry.key === key) ?? PROVIDERS[0]
  return (
    <Box>
      <TextField select size="small" label="Where did you buy the domain?" value={key} onChange={(event) => setKey(event.target.value)} sx={{ minWidth: 280, mb: 1.5 }}>
        {PROVIDERS.map((entry) => (
          <MenuItem key={entry.key} value={entry.key}>
            {entry.name}
          </MenuItem>
        ))}
      </TextField>
      <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
        {provider.steps.map((step) => (
          <Typography key={step} component="li" variant="body2">
            {step}
          </Typography>
        ))}
      </Box>
      {provider.watch && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {provider.watch}
        </Alert>
      )}
    </Box>
  )
}
