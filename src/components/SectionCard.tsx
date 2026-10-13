import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  /** One line saying what this card controls. */
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Tables and lists run edge to edge; forms keep the padding. */
  flush?: boolean
}

/**
 * A settings card, the way Shopify lays out Settings: a titled card per
 * concern, its actions top-right, and its description as subdued text under
 * the title rather than a second heading.
 */
export function SectionCard({ title, description, actions, children, flush }: SectionCardProps) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: flush ? 1 : undefined }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
          {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>{actions}</Box>}
        </Stack>
        {children && !flush && <Box sx={{ mt: 2 }}>{children}</Box>}
      </CardContent>
      {children && flush && <Box sx={{ pb: 1 }}>{children}</Box>}
    </Card>
  )
}
