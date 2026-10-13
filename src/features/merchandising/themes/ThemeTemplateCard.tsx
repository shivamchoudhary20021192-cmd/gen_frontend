import { Card, CardContent, CardHeader, Link, MenuItem, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'

/**
 * "Theme template", as on a Shopify product or collection page: which of the
 * live theme's templates shows this item — the default, or an alternate such
 * as product.gift.json. Saves on change, independent of the page's own form.
 */
export function ThemeTemplateCard({
  resource,
  id,
  value,
  disabled,
}: {
  resource: 'product' | 'collection'
  id: number | undefined
  value: string | null | undefined
  disabled?: boolean
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<string | null>(value ?? null)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setCurrent(value ?? null)
  }
  const templates = useQuery({
    queryKey: ['themes', 'templates', resource],
    queryFn: () => api.get<{ templates: { suffix: string | null; label: string }[] }>('/themes/templates', { type: resource }),
    staleTime: 60_000,
  })
  const save = useMutation({
    mutationFn: (suffix: string | null) =>
      resource === 'product'
        ? api.patch(`/products/${id}`, { product: { template_suffix: suffix } })
        : api.patch(`/collections/${id}`, { collection: { template_suffix: suffix } }),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: [resource === 'product' ? 'products' : 'collections'] })
    },
    onError: (caught) => {
      setError(errorMessage(caught))
      setCurrent(value ?? null)
    },
  })

  const options = templates.data?.templates ?? [{ suffix: null, label: `Default ${resource}` }]
  // An alternate the live theme no longer has still shows, so it can be changed.
  const known = current === null || options.some((option) => option.suffix === current)

  return (
    <Card>
      <CardHeader title="Theme template" slotProps={{ title: { variant: 'subtitle1' } }} />
      <CardContent sx={{ pt: 0 }}>
        <TextField
          select
          size="small"
          fullWidth
          value={current ?? ''}
          disabled={disabled || !id || save.isPending}
          onChange={(event) => {
            const next = event.target.value === '' ? null : event.target.value
            setCurrent(next)
            save.mutate(next)
          }}
          error={Boolean(error)}
          helperText={error ?? (id ? undefined : 'Save first to choose a template.')}
        >
          {options.map((option) => (
            <MenuItem key={option.suffix ?? ''} value={option.suffix ?? ''}>
              {option.label}
            </MenuItem>
          ))}
          {!known && current && <MenuItem value={current}>{`${resource}.${current} (not in the live theme)`}</MenuItem>}
        </TextField>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Alternate templates are made in the theme’s code editor (e.g. <code>{resource}.gift.json</code>) and laid out in the{' '}
          <Link component={RouterLink} to="/merchandising/themes">
            theme editor
          </Link>
          .
        </Typography>
      </CardContent>
    </Card>
  )
}
