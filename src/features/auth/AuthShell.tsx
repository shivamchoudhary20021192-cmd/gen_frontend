import { Box, Card, CardContent, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { tokens } from '../../theme'

/** The frame of every signed-out screen: the wordmark, one card, a footnote. */
export function AuthShell({ title, subtitle, children, footer, width = 400 }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: tokens.ivory, p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: width }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '0.18em' }}>
            VEYLOG
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Card>
          <CardContent sx={{ p: 3 }}>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {subtitle}
              </Typography>
            )}
            {children}
          </CardContent>
        </Card>
        {footer && <Box sx={{ mt: 2, textAlign: 'center' }}>{footer}</Box>}
      </Box>
    </Box>
  )
}
