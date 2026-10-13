import { Alert, Snackbar } from '@mui/material'
import type { Flash } from '../hooks/useFlash'

/** Bottom-centre confirmation, like Shopify's toast; errors stay until closed. */
export function FlashSnackbar({ flash, onClose }: { flash: Flash | null; onClose(): void }) {
  return (
    <Snackbar
      open={Boolean(flash)}
      autoHideDuration={flash?.severity === 'error' ? null : 4000}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') onClose()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {flash ? (
        <Alert severity={flash.severity} variant="filled" onClose={onClose} sx={{ minWidth: 280 }}>
          {flash.text}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}
