import { useEffect, useMemo, useState } from 'react'
import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/**
 * Choose what a link points at, by name.
 *
 * This replaces a numeric "Reference ID" box. Nobody knows that the Vitamin C
 * serum is 34 — they knew it for the twenty minutes they spent finding it in
 * another tab, and then they forgot, and the next person to open the form sees
 * a number and cannot tell whether it is right. A banner whose CTA silently
 * points at the wrong product is not a bug anyone reports; it is a link nobody
 * clicks.
 *
 * The search runs on the server, against indexed columns, and returns at most
 * twenty-five rows. Loading every product into the browser to filter it there
 * works at nine products and stops working somewhere before nine hundred.
 */

export interface LinkTarget {
  id: number
  label: string
  hint: string | null
  /** Why choosing this would not currently work — a draft, an inactive row. */
  warning: string | null
}

/** The kinds the server can search. Anything else falls back to a plain id. */
export const SEARCHABLE_LINK_TYPES = [
  'product',
  'category',
  'collection',
  'page',
  'policy',
  'article',
  'ingredient',
  'routine',
  'coupon',
] as const

export type SearchableLinkType = (typeof SEARCHABLE_LINK_TYPES)[number]

export function isSearchableLinkType(value: string): value is SearchableLinkType {
  return (SEARCHABLE_LINK_TYPES as readonly string[]).includes(value)
}

const NOUN: Record<SearchableLinkType, string> = {
  product: 'product',
  category: 'category',
  collection: 'collection',
  page: 'page',
  policy: 'policy',
  article: 'article',
  ingredient: 'ingredient',
  routine: 'routine',
  coupon: 'discount code',
}

/** A short pause so typing does not fire a request per keystroke. */
function useDebounced(value: string, delay = 250): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export function LinkTargetPicker({
  type,
  value,
  onChange,
  label,
  helperText,
  error,
  size = 'small',
  disabled,
}: {
  type: SearchableLinkType
  /** The stored id, as the form holds it. Empty string when nothing is chosen. */
  value: number | string | null | undefined
  onChange: (id: number | null) => void
  label?: string
  helperText?: string
  error?: boolean
  size?: 'small' | 'medium'
  disabled?: boolean
}) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const search = useDebounced(term)

  const chosenId = value === null || value === undefined || value === '' ? null : Number(value)

  const options = useQuery({
    queryKey: ['link-targets', type, search],
    queryFn: () =>
      api.get<{ targets: LinkTarget[]; truncated: boolean }>('/link-targets', {
        type,
        ...(search ? { q: search } : {}),
      }),
    // Only while the list is on screen. A form with four pickers on it should
    // not fire four searches the moment it loads.
    enabled: open,
    staleTime: 30_000,
  })

  /**
   * What the saved id actually is.
   *
   * Resolved separately from the search, because a form usually opens on a value
   * that is nowhere in the first page of results — and showing "42" until
   * someone types is the exact problem this control was built to remove.
   */
  const resolved = useQuery({
    queryKey: ['link-target', type, chosenId],
    queryFn: () => api.get<{ target: LinkTarget | null }>('/link-targets/resolve', { type, id: chosenId! }),
    enabled: chosenId !== null && chosenId > 0,
    staleTime: 5 * 60_000,
  })

  const chosen: LinkTarget | null = useMemo(() => {
    if (chosenId === null) return null
    if (resolved.data?.target) return resolved.data.target
    const inList = options.data?.targets.find((target) => target.id === chosenId)
    if (inList) return inList
    if (resolved.isFetched) {
      // It resolved to nothing: the thing it pointed at has been deleted. Said
      // plainly rather than shown as a blank field, which would look like the
      // link had never been set and invite someone to "fix" it by leaving it.
      return { id: chosenId, label: `#${chosenId} — no longer exists`, hint: null, warning: 'Deleted' }
    }
    return null
  }, [chosenId, resolved.data, resolved.isFetched, options.data])

  const list = options.data?.targets ?? []
  // The chosen row is kept in the option list even when the current search does
  // not match it, or MUI treats the value as out of range and clears the field.
  const withChosen = chosen && !list.some((item) => item.id === chosen.id) ? [chosen, ...list] : list

  return (
    <Autocomplete
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={withChosen}
      value={chosen}
      onChange={(_event, next) => onChange(next ? next.id : null)}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') setTerm(next)
        if (reason === 'clear') setTerm('')
      }}
      // The server has already searched; filtering again in the browser would
      // hide rows it matched on a column the label does not show, such as a slug.
      filterOptions={(candidates) => candidates}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionLabel={(option) => option.label}
      // Two rows can share a display name — a catalogue has more than one
      // "Gift set" — and without this MUI keys the list by the label and React
      // starts dropping or duplicating rows. The id is the only safe key.
      getOptionKey={(option) => option.id}
      loading={options.isFetching || resolved.isFetching}
      noOptionsText={
        options.isFetching ? 'Searching…' : term ? `No ${NOUN[type]} matches “${term}”` : `No ${NOUN[type]} yet`
      }
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key?: string } & React.HTMLAttributes<HTMLLIElement>
        return (
          <Box component="li" key={key ?? option.id} {...rest} sx={{ display: 'block !important', py: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {option.label}
            </Typography>
            {(option.hint || option.warning) && (
              <Typography variant="caption" sx={{ color: option.warning ? 'warning.main' : 'text.secondary' }}>
                {[option.hint, option.warning].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
        )
      }}
      // The spinner is left to MUI's own `loading` handling rather than merged
      // into the input's adornments: this MUI no longer hands `InputProps` to
      // renderInput, and reaching for it threw on every render — a picker that
      // looked correct in the source and blanked the whole card in the browser.
      renderInput={(params) => (
        <TextField
          {...params}
          size={size}
          label={label ?? `Which ${NOUN[type]}?`}
          placeholder={`Search ${NOUN[type]}s by name`}
          error={error || Boolean(chosen?.warning)}
          helperText={
            chosen?.warning
              ? `${chosen.warning}. The link will not work until this is live.`
              : (helperText ??
                (options.data?.truncated
                  ? `Showing the first ${list.length}. Keep typing to narrow it.`
                  : `Start typing to search. Stored as the ${NOUN[type]}'s id.`))
          }
        />
      )}
    />
  )
}
