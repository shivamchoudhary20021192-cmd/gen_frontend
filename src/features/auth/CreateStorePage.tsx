import { Alert, Button, Card, CardContent, Stack } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useShop } from '../../shop/useShop'
import { StoreFields, type StoreDraft } from './StoreFields'

interface Created {
  shop: { id: string; handle: string; name: string; status: string }
}

/**
 * Another store for someone who already has one — Shopify's "Create store"
 * from the store switcher. The new store is theirs to own, and the admin
 * switches straight into it.
 */
export function CreateStorePage() {
  const { switchTo } = useShop()
  const queryClient = useQueryClient()
  const [store, setStore] = useState<StoreDraft>({ name: '', handle: '', country_code: 'IN', vertical: 'general' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onChange = useCallback((next: StoreDraft) => setStore(next), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await api.post<Created>('/shops', {
        name: store.name,
        handle: store.handle || null,
        country_code: store.country_code,
        vertical: store.vertical,
      })
      const memberships = await api.get<{ shops: { shop_id: number; handle: string }[] }>('/auth/shops')
      await queryClient.invalidateQueries({ queryKey: ['shop'] })
      const membership = memberships.shops.find((entry) => entry.handle === created.shop.handle)
      if (membership) await switchTo(membership.shop_id)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Create another store" subtitle="Each store has its own catalogue, customers, orders, theme and plan." />
      <Card>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <Stack spacing={2} sx={{ maxWidth: 480 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <StoreFields value={store} onChange={onChange} />
              <Stack direction="row">
                <Button type="submit" variant="contained" disabled={busy || store.name.trim().length < 2}>
                  {busy ? 'Opening your store…' : 'Create store'}
                </Button>
              </Stack>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
