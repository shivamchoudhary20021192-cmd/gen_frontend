import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import type { StockItem } from '../api/types'
import { useDebounce } from '../hooks/useDebounce'

interface Option {
  variant_id: number
  label: string
  sku: string
  available: number
  tracked: boolean
}

function toOption(item: StockItem): Option {
  return {
    variant_id: item.variant_id,
    label: item.variant_title ? `${item.product_name} — ${item.variant_title}` : item.product_name,
    sku: item.sku,
    available: item.quantity_available,
    tracked: item.track_inventory,
  }
}

interface Props {
  label: string
  value: number | null
  onChange(variantId: number | null): void
  helperText?: string
  error?: boolean
  disabled?: boolean
}

/** Search the catalogue for one variant, by product name or SKU. */
export function VariantPicker({ label, value, onChange, helperText, error, disabled }: Props) {
  const [input, setInput] = useState('')
  const search = useDebounce(input, 300)

  const results = useQuery({
    queryKey: ['variant-picker', search],
    queryFn: () => api.get<{ items: StockItem[] }>('/inventory', { q: search || undefined, limit: 25 }),
    staleTime: 30_000,
  })
  const selected = useQuery({
    queryKey: ['variant-picker', 'one', value],
    queryFn: () => api.get<{ item: StockItem }>(`/inventory/${value}`),
    enabled: value !== null,
    staleTime: 60_000,
  })

  const options = useMemo(() => {
    const seen = new Map<number, Option>()
    for (const item of results.data?.items ?? []) if (!seen.has(item.variant_id)) seen.set(item.variant_id, toOption(item))
    return [...seen.values()]
  }, [results.data])
  const current = selected.data?.item ? toOption(selected.data.item) : null

  return (
    <Autocomplete
      options={current && !options.some((option) => option.variant_id === current.variant_id) ? [current, ...options] : options}
      value={current}
      onChange={(_event, option) => onChange(option?.variant_id ?? null)}
      onInputChange={(_event, text, reason) => {
        if (reason === 'input') setInput(text)
      }}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, other) => option.variant_id === other.variant_id}
      filterOptions={(list) => list}
      loading={results.isFetching}
      disabled={disabled}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <span style={{ flex: 1 }}>{option.label}</span>
            <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 12 }}>
              {option.sku}
              {option.tracked ? ` · ${option.available} available` : ''}
            </span>
          </li>
        )
      }}
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} error={error} placeholder="Search by product or SKU" />}
    />
  )
}
