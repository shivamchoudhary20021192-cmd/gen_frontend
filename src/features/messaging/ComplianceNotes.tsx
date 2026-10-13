import { Alert, AlertTitle, Stack, Typography } from '@mui/material'
import type { Violation } from './useMessaging'

/**
 * Why this cannot be sent, and what to do about it.
 *
 * Blockers first, in red, each with its fix underneath. A refusal that says
 * "invalid template" gets worked around; a refusal that says "register this
 * wording on the DLT portal and paste the ID here — it takes two to four
 * working days" gets acted on, and is the difference between a compliance
 * feature and a compliance obstacle.
 *
 * The text is the server's. This component decides only the order and the
 * colour, so the editor can never disagree with the thing that refuses the send.
 */
export function ComplianceNotes({
  violations,
  dense = false,
  emptyMessage,
}: {
  violations: Violation[]
  dense?: boolean
  emptyMessage?: string
}) {
  const blockers = violations.filter((violation) => violation.severity === 'blocker')
  const warnings = violations.filter((violation) => violation.severity === 'warning')

  if (violations.length === 0) {
    return emptyMessage ? (
      <Alert severity="success" variant="outlined" sx={{ py: dense ? 0.25 : 1 }}>
        {emptyMessage}
      </Alert>
    ) : null
  }

  return (
    <Stack spacing={1}>
      {blockers.length > 0 && (
        <Alert severity="error" variant="outlined">
          <AlertTitle sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
            {blockers.length === 1 ? 'This cannot be sent yet' : `${blockers.length} things stop this being sent`}
          </AlertTitle>
          <Stack spacing={1}>
            {blockers.map((violation, index) => (
              <div key={`${violation.code}-${index}`}>
                <Typography sx={{ fontSize: 13 }}>{violation.message}</Typography>
                {violation.fix && (
                  <Typography sx={{ fontSize: 12, opacity: 0.85, mt: 0.25 }}>{violation.fix}</Typography>
                )}
              </div>
            ))}
          </Stack>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert severity="warning" variant="outlined">
          <Stack spacing={0.75}>
            {warnings.map((violation, index) => (
              <div key={`${violation.code}-${index}`}>
                <Typography sx={{ fontSize: 13 }}>{violation.message}</Typography>
                {violation.fix && (
                  <Typography sx={{ fontSize: 12, opacity: 0.85, mt: 0.25 }}>{violation.fix}</Typography>
                )}
              </div>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  )
}
