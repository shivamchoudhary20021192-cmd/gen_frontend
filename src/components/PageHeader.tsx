import { Box, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: ReactNode
}

/**
 * Shopify's page header: a 20px semibold title on the left, actions on the
 * right, and nothing else competing with them.
 *
 * The subtitle sits under the title as small subdued text rather than as a
 * second heading — in Shopify that slot carries counts and handles ("4 total",
 * "/collections/brightening"), which are context, not headline.
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 2 }}>
      {back}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', minHeight: 32 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" noWrap sx={{ lineHeight: 1.25 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>{actions}</Box>}
      </Stack>
    </Box>
  )
}
