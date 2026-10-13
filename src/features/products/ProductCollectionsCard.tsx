import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  useManualCollectionOptions,
  useProductCollections,
  useSetProductCollections,
  type Collection,
} from '../collections/useCollections'

/**
 * Collections on the product form — Shopify's arrangement.
 *
 * A collection owns its membership, so the Collections page is where the
 * relationship really lives. But a merchandiser editing one product shouldn't
 * have to leave the page to file it, so the dropdown is here too, writing the
 * same `collection_products` rows.
 *
 * Only MANUAL collections can be picked. An automatic collection chose this
 * product from its rules; offering to detach it here would either lie or
 * quietly rewrite the rules for every other product too.
 */
export function ProductCollectionsCard({ productId }: { productId: number | undefined }) {
  const applied = useProductCollections(productId)
  const options = useManualCollectionOptions(Boolean(productId))
  const setCollections = useSetProductCollections(productId ?? 0)

  const [selected, setSelected] = useState<Collection[]>([])
  const [error, setError] = useState<string | null>(null)

  const manualIds = useMemo(() => applied.data?.manual_collection_ids ?? [], [applied.data])
  const available = useMemo(() => options.data?.collections ?? [], [options.data])

  useEffect(() => {
    if (!applied.data || available.length === 0) return
    setSelected(available.filter((collection) => manualIds.includes(collection.id)))
  }, [applied.data, available, manualIds])

  const automatic = (applied.data?.collections ?? []).filter((collection) => !collection.editable_here)

  if (!productId) {
    return (
      <Card>
        <CardHeader
          title="Collections"
          slotProps={{ title: { variant: 'subtitle1' } }}
          subheader="Save the product first, then file it into collections."
        />
      </Card>
    )
  }

  const commit = (next: Collection[]) => {
    setSelected(next)
    setError(null)
    setCollections.mutate(
      next.map((collection) => collection.id),
      {
        onError: (caught) => {
          setError(caught instanceof ApiError ? caught.message : 'Could not update collections.')
          void applied.refetch()
        },
        onSuccess: () => {
          void applied.refetch()
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title="Collections"
        slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
        subheader="Manual collections only — automatic ones pick their own products."
        action={
          setCollections.isPending ? (
            <CircularProgress size={18} sx={{ mt: 1.5, mr: 1.5 }} />
          ) : undefined
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Autocomplete
            multiple
            options={available}
            value={selected}
            loading={options.isLoading || applied.isLoading}
            onChange={(_, next) => commit(next)}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            // Two collections can share a title; the id is the only safe key.
            getOptionKey={(option) => option.id}
            renderOption={(props, option) => {
              const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string }
              return (
                <Box component="li" key={key} {...rest}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      /{option.slug} · {option.product_count} product
                      {option.product_count === 1 ? '' : 's'}
                      {!option.is_active && ' · hidden'}
                    </Typography>
                  </Box>
                </Box>
              )
            }}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...rest } = getItemProps({ index })
                return (
                  <Chip
                    key={key}
                    label={option.title}
                    size="small"
                    icon={<CollectionsBookmarkIcon sx={{ fontSize: 14 }} />}
                    {...rest}
                  />
                )
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add to collections"
                placeholder={selected.length === 0 ? 'Search collections…' : ''}
                helperText={
                  available.length === 0
                    ? 'No manual collections yet — create one from the Collections page.'
                    : 'Saved as soon as you pick.'
                }
              />
            )}
          />

          {automatic.length > 0 && (
            <>
              <Divider />
              <Box>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Also in, by rule
                  </Typography>
                </Stack>
                <Stack spacing={0.75}>
                  {automatic.map((collection) => (
                    <Stack
                      key={collection.id}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {collection.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Matched by its conditions
                        </Typography>
                      </Box>
                      <Tooltip title="Open the collection">
                        <IconButton
                          size="small"
                          component={RouterLink}
                          to={`/collections/${collection.id}`}
                          aria-label={`Open collection ${collection.title}`}
                        >
                          <OpenInNewIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
