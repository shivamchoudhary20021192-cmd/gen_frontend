import { useState } from 'react'
import { Box, InputAdornment, TextField } from '@mui/material'

/**
 * A colour: a swatch that opens the system picker, and the hex beside it for
 * anyone who has the brand colour to paste. The browser's own colour input,
 * drawn inside a text field, is a sliver nobody reads.
 */
export function ColorField({ label, value, onChange, width = 150 }: { label: string; value: string; onChange(next: string): void; width?: number }) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    // A new value from outside (the picker, a reset): show it.
    setSynced(value)
    setText(value)
  }
  return (
    <TextField
      size="small"
      label={label}
      value={text}
      onChange={(event) => {
        const next = event.target.value.trim()
        setText(next)
        if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase())
      }}
      onBlur={() => setText(value)}
      sx={{ width }}
      slotProps={{
        htmlInput: { maxLength: 7, spellCheck: false, 'aria-label': `${label} (hex)` },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Box
                component="input"
                type="color"
                value={value}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
                aria-label={label}
                sx={{ width: 22, height: 22, p: 0, border: 1, borderColor: 'divider', borderRadius: 0.75, cursor: 'pointer', background: 'none', '&::-webkit-color-swatch-wrapper': { p: 0 }, '&::-webkit-color-swatch': { border: 0, borderRadius: 0.5 } }}
              />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
