import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'

type Mode = 'optional' | 'disabled'

interface PreferencesResponse {
  preferences: { customer_accounts: Mode }
  storefront_url: string
}

const preferencesKey = ['online-store', 'preferences'] as const

const PERKS = [
  ['Order history and tracking', 'Every order placed with their phone number, with its progress and courier tracking.'],
  ['Saved addresses', 'An address book, filled in automatically from their first checkout.'],
  ['Faster checkout', 'Contact details and their default address are filled in for them.'],
  ['Their own preferences', 'Name, email and email marketing consent, changed by them.'],
] as const

/**
 * Settings → Customer accounts: whether the online store offers sign-in.
 *
 * Accounts are passwordless — a one-time code by text message or WhatsApp —
 * so there is no "required" mode to choose: checkout never asks anyone to
 * sign in, it only fills things in for people who have.
 */
export function CustomerAccountsPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('settings.manage')
  const { flash, success, error: flashError, clear } = useFlash()

  const preferences = useQuery({ queryKey: preferencesKey, queryFn: () => api.get<PreferencesResponse>('/online-store/preferences') })
  const saved = preferences.data?.preferences.customer_accounts ?? 'optional'
  const [draft, setDraft] = useState<Mode | null>(null)
  const mode = draft ?? saved

  const save = useMutation({
    mutationFn: (next: Mode) => api.put<PreferencesResponse>('/online-store/preferences', { customer_accounts: next }),
    onSuccess: (response) => {
      queryClient.setQueryData(preferencesKey, (current: PreferencesResponse | undefined) => (current ? { ...current, preferences: response.preferences } : current))
      setDraft(null)
      success(response.preferences.customer_accounts === 'optional' ? 'Customer accounts are on' : 'Customer accounts are off')
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const storefront = preferences.data?.storefront_url ?? ''

  return (
    <>
      <PageHeader
        title="Customer accounts"
        subtitle="Let shoppers sign in to see their orders and save their addresses."
        actions={
          canManage && (
            <Button variant="contained" disabled={draft === null || draft === saved || save.isPending} onClick={() => draft && save.mutate(draft)}>
              Save
            </Button>
          )
        }
      />

      {preferences.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(preferences.error)}</Alert>}

      <SectionCard
        title="Sign-in links"
        description="Shown as an account icon in your store’s header and as “Have an account? Sign in” at checkout."
      >
        <RadioGroup value={mode} onChange={(event) => setDraft(event.target.value as Mode)}>
          <FormControlLabel
            value="optional"
            disabled={!canManage}
            control={<Radio />}
            label={
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Show sign-in links
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Shoppers can sign in with a one-time code sent to their phone. Checking out as a guest still works.
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="disabled"
            disabled={!canManage}
            control={<Radio />}
            label={
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Don’t use customer accounts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No sign-in anywhere on the store; /account pages redirect to the home page.
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </SectionCard>

      <SectionCard title="How signing in works" description="No passwords to remember or reset.">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          A shopper enters their mobile number and gets a six-digit code by text message or WhatsApp. The number is the account: orders placed at
          checkout with the same number are already in their order history the first time they sign in.
        </Typography>
        <List dense disablePadding>
          {PERKS.map(([title, detail]) => (
            <ListItem key={title} disableGutters>
              <ListItemIcon sx={{ minWidth: 34 }}>
                <CheckCircleOutlinedIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary={title} secondary={detail} />
            </ListItem>
          ))}
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Codes are sent with the <strong>otp.login</strong> message template. Connect an SMS or WhatsApp sender under{' '}
          <Link component={RouterLink} to="/notifications/senders">
            Notifications → Senders
          </Link>{' '}
          so they reach real phones.
        </Typography>
      </SectionCard>

      <SectionCard title="Account pages" description="The sign-in, account, order and address pages are part of your theme, so they match your store.">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            href={`${storefront}/account/login`}
            target="_blank"
            rel="noopener"
            disabled={!storefront || mode === 'disabled'}
          >
            View sign-in page
          </Button>
          <Button variant="outlined" component={RouterLink} to="/merchandising/themes">
            Customize in the theme editor
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          In the theme editor, choose Customer account, Customer order or Customer addresses from the page menu; a sample customer stands in for the
          real one.
        </Typography>
      </SectionCard>

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
