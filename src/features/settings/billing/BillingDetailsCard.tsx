import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../../api/client'
import { SectionCard } from '../../../components/SectionCard'
import { errorMessage } from '../../../lib/errors'
import { billingKeys, type BillingOverview } from './billingTypes'

/**
 * Who the store's bills are made out to: the legal name, the tax ID (GSTIN in
 * India) and the state, which decides CGST + SGST or IGST on the platform's
 * bills. Applies from the next bill.
 */
export function BillingDetailsCard({ overview, canManage, onSaved }: { overview: BillingOverview; canManage: boolean; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient()
  const details = overview.tax_details
  const [form, setForm] = useState({
    legal_name: details?.legal_name ?? '',
    tax_id: details?.tax_id ?? '',
    tax_region: details?.tax_region ?? '',
    billing_email: details?.billing_email ?? '',
  })
  const save = useMutation({
    mutationFn: () => api.patch<BillingOverview>('/billing/details', { legal_name: form.legal_name || null, tax_id: form.tax_id || null, tax_region: form.tax_region || null, billing_email: form.billing_email || null }),
    onSuccess: (response) => {
      queryClient.setQueryData(billingKeys.overview, response)
      onSaved('Billing details saved — they apply from your next bill')
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const tax = overview.platform_tax
  const taxName = tax?.name ?? 'Tax'

  return (
    <SectionCard
      title="Billing details"
      description={tax ? `Bills include ${taxName} at ${tax.rate}% for stores in the same country as the platform${tax.tax_id ? ` (our ${taxName} number: ${tax.tax_id})` : ''}; elsewhere they are exports of services, with no ${taxName}.` : 'The name and address your bills are made out to.'}
    >
      <form onSubmit={submit}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Legal business name" value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} disabled={!canManage} fullWidth />
            <TextField label="Billing email" type="email" value={form.billing_email} onChange={(event) => setForm({ ...form, billing_email: event.target.value })} disabled={!canManage} helperText="Where bills and receipts are sent" fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label={tax?.country === 'IN' ? 'GSTIN' : 'Tax ID'}
              value={form.tax_id}
              onChange={(event) => setForm({ ...form, tax_id: event.target.value.toUpperCase() })}
              disabled={!canManage}
              helperText={tax?.country === 'IN' ? 'Printed on your bills, so you can claim the input tax credit' : 'Printed on your bills'}
              slotProps={{ htmlInput: { maxLength: 40, spellCheck: false } }}
              fullWidth
            />
            <TextField
              label="State or region code"
              value={form.tax_region}
              onChange={(event) => setForm({ ...form, tax_region: event.target.value.toUpperCase() })}
              disabled={!canManage}
              helperText={tax?.country === 'IN' ? 'Like KA or MH. It decides CGST + SGST or IGST; empty uses your main stock location' : 'Optional'}
              slotProps={{ htmlInput: { maxLength: 10 } }}
              fullWidth
            />
          </Stack>
          {save.isError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
          {canManage ? (
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save details'}
              </Button>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Only staff who manage billing can change these.
            </Typography>
          )}
        </Stack>
      </form>
    </SectionCard>
  )
}
