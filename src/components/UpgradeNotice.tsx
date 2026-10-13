import { Alert, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

/** Shown where a plan feature or limit stands in the way, with the way out. */
export function UpgradeNotice({ message }: { message: string }) {
  return (
    <Alert
      severity="info"
      sx={{ mb: 2 }}
      action={
        <Button component={RouterLink} to="/settings/billing" color="inherit" size="small">
          See plans
        </Button>
      }
    >
      {message}
    </Alert>
  )
}
