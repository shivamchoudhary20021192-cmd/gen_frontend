import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'
import type { CardSetup, CollectResult } from './billingTypes'
import { loadStripe, type StripeCardElement, type StripeClient } from './stripe'

interface Props {
  open: boolean
  onClose(): void
  onSaved(result: { payment_method: { label: string }; retried: CollectResult[] }): void
}

/**
 * Adds or replaces the card the platform bills. The server says how: Stripe's
 * card field, the simulator's test cards in development, or a note that this
 * store is invoiced instead.
 */
export function PaymentMethodDialog({ open, onClose, onSaved }: Props) {
  const [setup, setSetup] = useState<CardSetup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Mounted fresh for each attempt (the page renders it only while open), so
  // every attempt starts a new card setup with a clean slate.
  useEffect(() => {
    let cancelled = false
    api
      .post<CardSetup>('/billing/payment-method')
      .then((result) => {
        if (!cancelled) setSetup(result)
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const confirm = async (reference: string) => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<{ payment_method: { label: string }; retried: CollectResult[] }>('/billing/payment-method/confirm', { reference })
      onSaved(result)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Payment method</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Your plan and transaction fees are charged to this card. Unpaid bills are retried as soon as it is saved.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {!setup && !error && (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {setup && 'message' in setup && <Alert severity="info">{setup.message}</Alert>}
          {setup && 'test_tokens' in setup && <TestCards tokens={setup.test_tokens} busy={busy} onPick={confirm} onCancel={onClose} />}
          {setup && 'client_secret' in setup && (
            <StripeCard clientSecret={setup.client_secret} publishableKey={setup.publishable_key} busy={busy} setBusy={setBusy} onError={setError} onConfirmed={confirm} onCancel={onClose} />
          )}
        </Stack>
      </DialogContent>
      {setup && 'message' in setup && (
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      )}
      {!setup && error && (
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

function TestCards({ tokens, busy, onPick, onCancel }: { tokens: { token: string; description: string }[]; busy: boolean; onPick(token: string): void; onCancel(): void }) {
  const [picked, setPicked] = useState(tokens[0]?.token ?? '')
  return (
    <>
      <Alert severity="info" variant="outlined">
        Test mode: billing runs on the simulator. Pick a card to see how the store behaves.
      </Alert>
      <RadioGroup value={picked} onChange={(event) => setPicked(event.target.value)}>
        {tokens.map((token) => (
          <FormControlLabel key={token.token} value={token.token} control={<Radio size="small" />} label={token.description} />
        ))}
      </RadioGroup>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy || !picked} onClick={() => onPick(picked)}>
          {busy ? 'Saving…' : 'Save card'}
        </Button>
      </Stack>
    </>
  )
}

function StripeCard({
  clientSecret,
  publishableKey,
  busy,
  setBusy,
  onError,
  onConfirmed,
  onCancel,
}: {
  clientSecret: string
  publishableKey: string
  busy: boolean
  setBusy(value: boolean): void
  onError(message: string | null): void
  onConfirmed(setupIntentId: string): Promise<void>
  onCancel(): void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<StripeClient | null>(null)
  const cardRef = useRef<StripeCardElement | null>(null)
  const [complete, setComplete] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let card: StripeCardElement | null = null
    let cancelled = false
    loadStripe()
      .then((factory) => {
        if (cancelled || !mountRef.current) return
        const stripe = factory(publishableKey)
        card = stripe.elements().create('card', { hidePostalCode: false })
        card.mount(mountRef.current)
        card.on('change', (event) => {
          setComplete(event.complete)
          onError(event.error?.message ?? null)
        })
        stripeRef.current = stripe
        cardRef.current = card
        setReady(true)
      })
      .catch((caught: Error) => onError(caught.message))
    return () => {
      cancelled = true
      card?.destroy()
    }
  }, [publishableKey, onError])

  const submit = async () => {
    if (!stripeRef.current || !cardRef.current) return
    setBusy(true)
    onError(null)
    const result = await stripeRef.current.confirmCardSetup(clientSecret, { payment_method: { card: cardRef.current } })
    if (result.error || !result.setupIntent) {
      onError(result.error?.message ?? 'The card could not be confirmed.')
      setBusy(false)
      return
    }
    await onConfirmed(result.setupIntent.id)
  }

  return (
    <>
      <Box ref={mountRef} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, minHeight: 44 }} />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy || !ready || !complete} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Save card'}
        </Button>
      </Stack>
    </>
  )
}
