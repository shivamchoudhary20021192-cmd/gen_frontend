import { Alert, AlertTitle, Button } from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { formatDate } from '../lib/format'
import { useShop } from '../shop/useShop'

/**
 * Why the store is not selling, when it is not: frozen for an unpaid bill,
 * paused by its owner, being set up, or on a trial about to end with no card.
 * Shown above every page, because each of these changes what the admin can do.
 */
export function StoreStatusBanner() {
  const { summary } = useShop()
  // Read once per mount: a banner counting days does not need to tick.
  const [now] = useState(() => Date.now())
  if (!summary) return null
  const { shop, subscription } = summary

  if (shop.status === 'frozen') {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button component={RouterLink} to="/settings/billing" color="inherit" size="small">
            Pay now
          </Button>
        }
      >
        <AlertTitle>Your store is frozen</AlertTitle>
        {shop.status_reason ?? 'A bill is unpaid.'} Customers cannot place orders and the admin is read-only until it is paid.
      </Alert>
    )
  }
  if (shop.status === 'paused') {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button component={RouterLink} to="/settings/store" color="inherit" size="small">
            Resume
          </Button>
        }
      >
        Your store is paused: the catalogue is visible, but checkout is closed.
      </Alert>
    )
  }
  if (shop.status === 'provisioning') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        We are still setting up your store. This usually takes a few seconds.
      </Alert>
    )
  }
  if (shop.status === 'suspended' || shop.status === 'closed') {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        This store is {shop.status}. {shop.status_reason ?? ''}
      </Alert>
    )
  }
  if (subscription?.status === 'past_due') {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button component={RouterLink} to="/settings/billing" color="inherit" size="small">
            Review bill
          </Button>
        }
      >
        A payment for your plan failed. Update your card to avoid your store being frozen.
      </Alert>
    )
  }
  if (subscription?.status === 'trialing' && subscription.trial_ends_at) {
    const daysLeft = Math.ceil((new Date(subscription.trial_ends_at).getTime() - now) / 86_400_000)
    if (daysLeft <= 3 && daysLeft >= 0) {
      return (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={RouterLink} to="/settings/billing" color="inherit" size="small">
              Choose a plan
            </Button>
          }
        >
          Your trial ends on {formatDate(subscription.trial_ends_at)}.
        </Alert>
      )
    }
  }
  return null
}
