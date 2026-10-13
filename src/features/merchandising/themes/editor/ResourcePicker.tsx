import { useEffect, useMemo, useState } from 'react'
import { Autocomplete, Avatar, Box, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../../api/client'
import { themeKeys, type ThemeResource } from '../themeTypes'

/**
 * Chooses a product, collection, page, blog or menu for a theme setting — by
 * name, stored by handle, as Shopify theme settings are. Searches on the
 * server; resolves the handles already chosen back to their titles so the
 * field never shows a bare "summer-sale-2".
 */

type ResourceType = 'product' | 'collection' | 'page' | 'blog' | 'article' | 'link_list'

const NOUN: Record<ResourceType, string> = {
  product: 'product',
  collection: 'collection',
  page: 'page',
  blog: 'blog',
  article: 'blog post',
  link_list: 'menu',
}

function useDebounced(value: string, delay = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

interface Props {
  type: ResourceType
  label: string
  info?: string
  disabled?: boolean
}

function useResources(type: ResourceType, term: string, enabled: boolean) {
  return useQuery({
    queryKey: themeKeys.resources(type, term),
    queryFn: () => api.get<{ resources: ThemeResource[] }>('/themes/resources', { type, q: term || undefined }),
    enabled,
    staleTime: 30_000,
  })
}

function useResolved(type: ResourceType, handles: string[]) {
  const key = handles.join(',')
  return useQuery({
    queryKey: themeKeys.resources(type, `=${key}`),
    queryFn: () => api.get<{ resources: ThemeResource[] }>('/themes/resources', { type, handles: key }),
    enabled: handles.length > 0,
    staleTime: 5 * 60_000,
  })
}

function Option({ option }: { option: ThemeResource }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      {option.image ? (
        <Avatar variant="rounded" src={option.image} sx={{ width: 32, height: 32 }} />
      ) : (
        <Avatar variant="rounded" sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'action.hover', color: 'text.secondary' }}>
          {option.title.slice(0, 1).toUpperCase()}
        </Avatar>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {option.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {[option.handle, option.hint].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </Box>
  )
}

export function ResourcePicker({ type, label, info, disabled, value, onChange }: Props & { value: string | null; onChange: (handle: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const search = useDebounced(term)
  const options = useResources(type, search, open)
  const resolved = useResolved(type, value ? [value] : [])
  const chosen = useMemo<ThemeResource | null>(() => {
    if (!value) return null
    return resolved.data?.resources.find((item) => item.handle === value) ?? options.data?.resources.find((item) => item.handle === value) ?? { handle: value, title: value, image: null, hint: resolved.isFetched ? 'Not found' : null }
  }, [value, resolved.data, resolved.isFetched, options.data])
  const list = options.data?.resources ?? []
  const withChosen = chosen && !list.some((item) => item.handle === chosen.handle) ? [chosen, ...list] : list

  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={withChosen}
      value={chosen}
      onChange={(_event, next) => onChange(next ? next.handle : null)}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') setTerm(next)
        if (reason === 'clear') setTerm('')
      }}
      filterOptions={(candidates) => candidates}
      isOptionEqualToValue={(option, selected) => option.handle === selected.handle}
      getOptionLabel={(option) => option.title}
      getOptionKey={(option) => option.handle}
      loading={options.isFetching}
      noOptionsText={term ? `No ${NOUN[type]} matches “${term}”` : `No ${NOUN[type]}s yet`}
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key?: string } & React.HTMLAttributes<HTMLLIElement>
        return (
          <Box component="li" key={key ?? option.handle} {...rest}>
            <Option option={option} />
          </Box>
        )
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={`Search ${NOUN[type]}s`} helperText={chosen?.hint === 'Not found' ? `This ${NOUN[type]} no longer exists.` : info} error={chosen?.hint === 'Not found'} />}
    />
  )
}

export function ResourceListPicker({ type, label, info, disabled, value, limit = 50, onChange }: Props & { value: string[]; limit?: number; onChange: (handles: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const search = useDebounced(term)
  const options = useResources(type, search, open)
  const resolved = useResolved(type, value)
  const chosen = value.map((handle) => resolved.data?.resources.find((item) => item.handle === handle) ?? { handle, title: handle, image: null, hint: null })
  const list = options.data?.resources ?? []

  return (
    <Autocomplete
      multiple
      size="small"
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={list}
      value={chosen}
      onChange={(_event, next) => onChange(next.slice(0, limit).map((item) => item.handle))}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') setTerm(next)
      }}
      filterOptions={(candidates) => candidates}
      isOptionEqualToValue={(option, selected) => option.handle === selected.handle}
      getOptionLabel={(option) => option.title}
      getOptionKey={(option) => option.handle}
      loading={options.isFetching}
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key?: string } & React.HTMLAttributes<HTMLLIElement>
        return (
          <Box component="li" key={key ?? option.handle} {...rest}>
            <Option option={option} />
          </Box>
        )
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : `Search ${NOUN[type]}s`} helperText={info ?? `Up to ${limit}.`} />}
    />
  )
}
