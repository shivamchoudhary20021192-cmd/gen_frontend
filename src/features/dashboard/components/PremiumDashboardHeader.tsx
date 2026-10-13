/**
 * PremiumDashboardHeader Component
 * 
 * World-class header following top design principles:
 * - Clear Information Architecture
 * - Contextual Actions
 * - Progressive Disclosure
 * - Micro-interactions
 * 
 * Design Inspiration: Linear, Notion, Stripe Dashboard
 */

import { memo, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  alpha,
  Tooltip,
  Stack,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DownloadIcon from '@mui/icons-material/Download'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import { tokens } from '../../../theme'

export interface PremiumDashboardHeaderProps {
  onRefresh?: () => void
  onExport?: () => void
  isRefreshing?: boolean
  lastUpdated?: Date | null
}

/**
 * Format last updated time
 */
const formatLastUpdated = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'Just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  
  return date.toLocaleDateString('en-IN', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * PremiumDashboardHeader Component
 */
export const PremiumDashboardHeader = memo<PremiumDashboardHeaderProps>(
  function PremiumDashboardHeader({
    onRefresh,
    onExport,
    isRefreshing = false,
    lastUpdated,
  }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const open = Boolean(anchorEl)

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget)
    }

    const handleMenuClose = () => {
      setAnchorEl(null)
    }

    const handlePrint = () => {
      window.print()
      handleMenuClose()
    }

    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Dashboard Analytics',
            text: 'Check out these analytics',
            url: window.location.href,
          })
        } catch (err) {
          // User cancelled share
        }
      }
      handleMenuClose()
    }

    return (
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Left: Title + Status */}
        <Box sx={{ flex: 1 }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: 28, sm: 32 },
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  color: tokens.ink,
                }}
              >
                Dashboard
              </Typography>
              
              {/* Live indicator */}
              <Chip
                label="Live"
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  backgroundColor: alpha(tokens.success, 0.1),
                  color: tokens.success,
                  border: 'none',
                  '& .MuiChip-label': {
                    px: 1,
                  },
                  '&::before': {
                    content: '""',
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: tokens.success,
                    marginRight: 0.5,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  },
                  '@keyframes pulse': {
                    '0%, 100%': {
                      opacity: 1,
                    },
                    '50%': {
                      opacity: 0.5,
                    },
                  },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography
                variant="body2"
                sx={{
                  color: tokens.subdued,
                  fontSize: 14,
                }}
              >
                Real-time analytics and insights
              </Typography>
              
              {lastUpdated && (
                <>
                  <Box
                    sx={{
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      backgroundColor: tokens.border,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: tokens.subdued,
                      fontSize: 12,
                    }}
                  >
                    Updated {formatLastUpdated(lastUpdated)}
                  </Typography>
                </>
              )}
            </Box>
          </Stack>
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Refresh Button */}
          <Tooltip title="Refresh data" arrow>
            <Button
              variant="outlined"
              size="medium"
              onClick={onRefresh}
              disabled={isRefreshing}
              startIcon={
                <RefreshIcon
                  sx={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              }
              sx={{
                borderColor: tokens.border,
                color: tokens.ink,
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                minWidth: 'auto',
                
                '&:hover': {
                  borderColor: tokens.ink,
                  backgroundColor: alpha(tokens.ink, 0.04),
                },
                
                '&:disabled': {
                  borderColor: tokens.border,
                  color: tokens.subdued,
                },

                // Hide text on mobile
                '& .MuiButton-startIcon': {
                  mr: { xs: 0, sm: 1 },
                },
                '& .MuiButton-startIcon + *': {
                  display: { xs: 'none', sm: 'inline' },
                },
              }}
            >
              Refresh
            </Button>
          </Tooltip>

          {/* Export Button */}
          {onExport && (
            <Tooltip title="Export all data" arrow>
              <Button
                variant="contained"
                size="medium"
                onClick={onExport}
                startIcon={<DownloadIcon />}
                sx={{
                  backgroundColor: tokens.ink,
                  color: tokens.white,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2,
                  boxShadow: 'none',
                  minWidth: 'auto',
                  
                  '&:hover': {
                    backgroundColor: tokens.ink,
                    boxShadow: `0 4px 12px ${alpha(tokens.ink, 0.3)}`,
                  },

                  // Hide text on mobile
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0, sm: 1 },
                  },
                  '& .MuiButton-startIcon + *': {
                    display: { xs: 'none', sm: 'inline' },
                  },
                }}
              >
                Export
              </Button>
            </Tooltip>
          )}

          {/* More Actions Menu */}
          <Tooltip title="More options" arrow>
            <IconButton
              onClick={handleMenuClick}
              size="medium"
              sx={{
                border: `1px solid ${tokens.border}`,
                borderRadius: 1,
                
                '&:hover': {
                  borderColor: tokens.ink,
                  backgroundColor: alpha(tokens.ink, 0.04),
                },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{
              paper: {
                elevation: 3,
                sx: {
                  mt: 1,
                  minWidth: 180,
                  borderRadius: 2,
                  border: `1px solid ${tokens.border}`,
                  boxShadow: `0 4px 20px ${alpha(tokens.ink, 0.08)}`,
                },
              },
            }}
          >
            <MenuItem
              onClick={handleShare}
              sx={{
                gap: 1.5,
                fontSize: 14,
                py: 1.5,
                
                '&:hover': {
                  backgroundColor: alpha(tokens.ink, 0.04),
                },
              }}
            >
              <ShareOutlinedIcon sx={{ fontSize: 18, color: tokens.subdued }} />
              Share Dashboard
            </MenuItem>
            
            <MenuItem
              onClick={handlePrint}
              sx={{
                gap: 1.5,
                fontSize: 14,
                py: 1.5,
                
                '&:hover': {
                  backgroundColor: alpha(tokens.ink, 0.04),
                },
              }}
            >
              <PrintOutlinedIcon sx={{ fontSize: 18, color: tokens.subdued }} />
              Print View
            </MenuItem>
            
            <MenuItem
              onClick={handleMenuClose}
              sx={{
                gap: 1.5,
                fontSize: 14,
                py: 1.5,
                
                '&:hover': {
                  backgroundColor: alpha(tokens.ink, 0.04),
                },
              }}
            >
              <SettingsOutlinedIcon sx={{ fontSize: 18, color: tokens.subdued }} />
              Dashboard Settings
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    )
  }
)
