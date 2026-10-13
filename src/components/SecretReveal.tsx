import { Alert, Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'

/** A credential shown exactly once, with a copy button and the warning to match. */
export function SecretReveal({ items }: { items: { label: string; value: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <Stack spacing={1.5}>
      <Alert severity="warning">Copy these now. For your security they are never shown again.</Alert>
      {items.map((item) => (
        <Box key={item.label}>
          <Typography variant="caption">{item.label}</Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.5 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
              {item.value}
            </Typography>
            <Tooltip title={copied === item.label ? 'Copied' : 'Copy'}>
              <IconButton
                size="small"
                onClick={() =>
                  void navigator.clipboard?.writeText(item.value).then(() => {
                    setCopied(item.label)
                    window.setTimeout(() => setCopied(null), 1500)
                  })
                }
              >
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}
