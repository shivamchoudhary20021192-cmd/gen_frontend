import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { platformApi } from '../../api/client'
import { useDebounce } from '../../hooks/useDebounce'
import { countryName } from '../../lib/format'

export interface StoreDraft {
  name: string
  handle: string
  country_code: string
  vertical: string
}

interface SignupOptions {
  verticals: { key: string; name: string; description: string; theme: string }[]
  countries: string[]
}

/**
 * What every new store needs: a name, its address on the platform, the country
 * it sells from (which decides currency, tax and delivery defaults) and what it
 * sells (which decides its starting theme and catalogue structure).
 */
export function StoreFields({ value, onChange }: { value: StoreDraft; onChange(next: StoreDraft): void }) {
  const options = useQuery({
    queryKey: ['signup-options'],
    queryFn: () => platformApi.anonymousGet<SignupOptions>('/signup/options'),
    staleTime: Infinity,
  })
  const [handleTouched, setHandleTouched] = useState(false)
  const debouncedName = useDebounce(value.name, 400)
  const debouncedHandle = useDebounce(value.handle, 400)

  // Suggest an address from the name until the person types their own.
  const suggestion = useQuery({
    queryKey: ['suggest-handle', debouncedName],
    queryFn: () => platformApi.anonymousGet<{ handle: string }>('/signup/suggest-handle', { name: debouncedName }),
    enabled: !handleTouched && debouncedName.trim().length >= 2,
  })
  useEffect(() => {
    if (!handleTouched && suggestion.data?.handle && suggestion.data.handle !== value.handle) {
      onChange({ ...value, handle: suggestion.data.handle })
    }
  }, [suggestion.data, handleTouched, value, onChange])

  const availability = useQuery({
    queryKey: ['handle-available', debouncedHandle],
    queryFn: () => platformApi.anonymousGet<{ handle: string; available: boolean; reason?: string }>(`/signup/handles/${encodeURIComponent(debouncedHandle)}`),
    enabled: handleTouched && debouncedHandle.length >= 1,
  })
  const handleTaken = handleTouched && availability.data && !availability.data.available

  return (
    <>
      <TextField
        label="Store name"
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Lotus Botanics"
        required
        fullWidth
      />
      <Box>
        <TextField
          label="Store address"
          value={value.handle}
          onChange={(event) => {
            setHandleTouched(true)
            onChange({ ...value, handle: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
          }}
          error={Boolean(handleTaken)}
          helperText={
            handleTaken
              ? availability.data?.reason === 'invalid'
                ? 'Use lowercase letters, numbers and hyphens.'
                : 'That address is taken.'
              : 'Your store opens at this address; you can connect your own domain later.'
          }
          slotProps={{ input: { endAdornment: <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>.myveylog.com</Typography> } }}
          fullWidth
        />
      </Box>
      <TextField
        select
        label="Where is your business?"
        value={value.country_code}
        onChange={(event) => onChange({ ...value, country_code: event.target.value })}
        helperText="Sets your currency, taxes and delivery defaults."
        fullWidth
      >
        {(options.data?.countries ?? [value.country_code]).map((code) => (
          <MenuItem key={code} value={code}>
            {countryName(code)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="What will you sell?"
        value={value.vertical}
        onChange={(event) => onChange({ ...value, vertical: event.target.value })}
        helperText={options.data?.verticals.find((vertical) => vertical.key === value.vertical)?.description ?? ' '}
        fullWidth
      >
        {/* Until the list loads, the chosen value is the only option, so the select never holds a value it cannot show. */}
        {(options.data?.verticals ?? [{ key: value.vertical, name: 'Loading…', description: '', theme: '' }]).map((vertical) => (
          <MenuItem key={vertical.key} value={vertical.key}>
            {vertical.name}
          </MenuItem>
        ))}
      </TextField>
    </>
  )
}
