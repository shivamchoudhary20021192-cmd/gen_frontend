import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon2 from '@mui/icons-material/Menu'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { StoreStatusBanner } from './StoreStatusBanner'
import { StoreSwitcher } from './StoreSwitcher'
import { useSidebar } from '../hooks/useSidebar'
import { menuIcon } from '../navigation/icons'
import { isImplemented } from '../navigation/routeRegistry'
import { useNavigation, type MenuNode } from '../navigation/useNavigation'
import { tokens } from '../theme'

const DRAWER_WIDTH = 232
const TOPBAR_HEIGHT = 56
/** Shopify caps its content column rather than letting it span a 27" monitor. */
const CONTENT_MAX = 1000

/**
 * Screens that are not a document and need the whole window.
 *
 * The cap above is right for a form or a table — a line of text 1600px wide is
 * unreadable — and wrong for a canvas. The page builder puts a storefront
 * preview between two panes; capped at 1000px the preview gets about 300, which
 * is not a preview of anything. Listed by route prefix rather than solved with
 * a negative margin, so it is obvious from here which screens escape and why.
 */
// The theme editor (/merchandising/themes/:id) wants the whole width for its preview; the theme list does not.
const FULL_BLEED_ROUTES = ['/merchandising/pages', '/merchandising/themes/']

/**
 * An item is clickable only when the server says it is available AND this
 * build knows how to render it. Everything else shows greyed with a "Soon"
 * chip — the shape of the product is visible without handing anyone a dead link.
 */
function isNavigable(node: MenuNode): boolean {
  return node.status === 'available' && Boolean(node.route) && isImplemented(node.key)
}

function hasNavigableDescendant(node: MenuNode): boolean {
  return isNavigable(node) || node.children.some(hasNavigableDescendant)
}

export function AppLayout() {
  const { admin, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const menu = useNavigation()
  const sidebar = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => menu.data?.sections ?? [], [menu.data])
  const isCollapsed = sidebar.isCollapsed && !sidebar.isHovering
  const drawerWidth = sidebar.width

  // Auto-expand whichever group contains the current route, so a deep link
  // lands with its parent already open.
  useEffect(() => {
    if (sections.length === 0) return
    setExpanded((current) => {
      const next = { ...current }
      for (const section of sections) {
        for (const item of section.items) {
          if (item.children.length === 0) continue
          const active = item.children.some(
            (child) => child.route && location.pathname.startsWith(child.route),
          )
          if (active) next[item.key] = true
        }
      }
      return next
    })
  }, [sections, location.pathname])

  const initials = `${admin?.first_name?.[0] ?? ''}${admin?.last_name?.[0] ?? ''}`.toUpperCase()

  const renderItem = (node: MenuNode, depth = 0) => {
    const Icon = menuIcon(node.icon)
    const navigable = isNavigable(node)
    const children = node.children
    const hasChildren = children.length > 0
    const open = expanded[node.key] ?? false

    // A group whose children are all unbuilt is itself not worth expanding.
    const groupUsable = hasChildren && children.some(hasNavigableDescendant)
    const disabled = !navigable && !groupUsable

    // Apply icon color from database
    const iconColor = node.icon_color || 'inherit'

    const inner = (
      <>
        <ListItemIcon sx={{ 
          minWidth: isCollapsed ? 0 : 26,
          justifyContent: 'center',
          color: iconColor,
          mx: isCollapsed ? 'auto' : 0,
        }}>
          {node.badge ? (
            <Badge
              badgeContent={node.badge.count}
              max={99}
              color={node.badge.variant === 'default' ? 'primary' : node.badge.variant}
              sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 14, minWidth: 14 } }}
            >
              <Icon sx={{ fontSize: 18 }} />
            </Badge>
          ) : (
            <Icon sx={{ fontSize: 18 }} />
          )}
        </ListItemIcon>
        {!isCollapsed && (
          <>
            <ListItemText
              primary={node.title}
              slotProps={{
                primary: {
                  variant: 'body2',
                  noWrap: true,
                  sx: { fontWeight: 500, fontSize: 13 },
                },
              }}
            />
            {/* Keyboard Shortcut Display - Commented out for now */}
            {/* {node.keyboard_shortcut && depth === 0 && (
              <Chip
                label={node.keyboard_shortcut}
                size="small"
                sx={{
                  height: 17,
                  fontSize: 10,
                  bgcolor: alpha('#000', 0.06),
                  mr: 0.5,
                }}
              />
            )} */}
            {disabled && (
              <Chip
                label="Soon"
                sx={{ height: 17, fontSize: 10, bgcolor: '#DEDEDE', color: tokens.subdued, ml: 0.5 }}
              />
            )}
            {/* Only show expand/collapse arrows when NOT collapsed */}
            {hasChildren &&
              (navigable ? (
                /**
                 * A routed group (Products, Orders) navigates when its row is
                 * clicked, so the chevron has to own the open/shut toggle on its
                 * own — hence a real button that swallows the click before the
                 * row's NavLink sees it.
                 */
                <Box
                  component="span"
                  role="button"
                  tabIndex={-1}
                  aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setExpanded((current) => ({ ...current, [node.key]: !open }))
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: tokens.hover },
                  }}
                >
                  {open ? (
                    <ExpandLessIcon sx={{ fontSize: 16, color: tokens.faint }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 16, color: tokens.faint }} />
                  )}
                </Box>
              ) : open ? (
                <ExpandLessIcon sx={{ fontSize: 16, color: tokens.faint }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16, color: tokens.faint }} />
              ))}
          </>
        )}
      </>
    )

    const sx = {
      borderRadius: '8px',
      minHeight: 32,
      mb: '2px',
      pl: isCollapsed ? 0.5 : (depth === 0 ? 1 : 3.25),
      pr: isCollapsed ? 0.5 : 1,
      py: 0.25,
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      color: tokens.ink,
      opacity: disabled ? 0.5 : 1,
      transition: 'all 200ms ease',
      '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
      '&.active': {
        bgcolor: tokens.selected,
        color: tokens.inkStrong,
        boxShadow: '0 1px 2px rgba(26,26,26,0.12)',
        '& .MuiListItemIcon-root': { color: tokens.inkStrong },
        '& .MuiListItemText-primary': { fontWeight: 600 },
      },
    } as const

    /**
     * A node that has both a route and children used to render as a toggle
     * only, which left /products and /orders unreachable from the sidebar —
     * the row they are named on just opened the group. Now the row navigates
     * (and opens the group on the way) while the chevron above does the
     * closing, which is how Shopify's own sidebar behaves.
     */
    const button = navigable ? (
      <ListItemButton
        component={NavLink}
        to={node.route!}
        onClick={() => {
          if (hasChildren) setExpanded((current) => ({ ...current, [node.key]: true }))
          setMobileOpen(false)
        }}
        sx={sx}
      >
        {inner}
      </ListItemButton>
    ) : (
      <Box component="span">
        <ListItemButton
          disabled={disabled}
          /**
           * A group row is a disclosure, so it says whether it is open. Without
           * this a screen reader announces "Content, button" and nothing about
           * the five items hidden behind it — and nothing outside this component
           * can tell an open group from a shut one either.
           */
          aria-expanded={hasChildren && !disabled ? open : undefined}
          onClick={() => {
            // Only unrouted groups reach here now; a routed one is a NavLink.
            if (hasChildren) {
              setExpanded((current) => ({ ...current, [node.key]: !open }))
            }
          }}
          sx={{ ...sx, width: '100%' }}
        >
          {inner}
        </ListItemButton>
      </Box>
    )

    const tooltipContent = isCollapsed ? (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {node.title}
        </Typography>
        {node.hover_description && (
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {node.hover_description}
          </Typography>
        )}
      </Box>
    ) : null

    return (
      <Box key={node.key}>
        {isCollapsed && depth === 0 ? (
          <Tooltip title={tooltipContent || node.title} placement="right" arrow>
            {button}
          </Tooltip>
        ) : disabled ? (
          <Tooltip title="Not built yet" placement="right">
            {button}
          </Tooltip>
        ) : (
          button
        )}

        {node.divider_after && !isCollapsed && (
          <Divider sx={{ my: 1, mx: 1 }} />
        )}

        {hasChildren && !isCollapsed && (
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List disablePadding>{children.map((child) => renderItem(child, depth + 1))}</List>
          </Collapse>
        )}
      </Box>
    )
  }

  const drawer = (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        bgcolor: tokens.rail,
        overflow: 'hidden', // Prevent double scrollbar
      }}
      onMouseEnter={() => sidebar.setHovering(true)}
      onMouseLeave={() => sidebar.setHovering(false)}
    >
      {/* Scrollable Menu Area */}
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          px: isCollapsed ? 0.5 : 1, 
          py: 1.5,
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha('#000', 0.2),
            borderRadius: '3px',
            '&:hover': {
              background: alpha('#000', 0.3),
            },
          },
        }}
      >
        {menu.isLoading ? (
          <Box sx={{ px: 0.5 }}>
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} height={32} sx={{ my: 0.5, borderRadius: 1 }} />
            ))}
          </Box>
        ) : (
          sections.map((section) => (
            <Box key={section.section} sx={{ mb: 1.5 }}>
              {!isCollapsed && (
                <Typography
                  sx={{
                    px: 1,
                    mb: 0.5,
                    display: 'block',
                    color: tokens.subdued,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {section.section}
                </Typography>
              )}
              <List disablePadding>{section.items.map((item) => renderItem(item))}</List>
            </Box>
          ))
        )}
      </Box>

      {/* Fixed Footer - Always at Bottom */}
      <Box sx={{ flexShrink: 0 }}>
        <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)' }} />
        
        {/* User Info and Toggle Button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: isCollapsed ? 1 : 1.5,
            backgroundColor: alpha('#000', 0.02),
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: alpha('#000', 0.04),
            },
          }}
        >
          {/* User Avatar */}
          <Tooltip 
            title={isCollapsed ? admin?.email : ''} 
            placement="right"
            arrow
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#5C5C5C',
                fontSize: 12,
                fontWeight: 600,
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              {initials || '?'}
            </Avatar>
          </Tooltip>

          {/* User Info (Hidden when collapsed) */}
          {!isCollapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" noWrap sx={{ display: 'block', color: tokens.subdued, fontWeight: 600 }}>
                {admin?.email}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: tokens.faint }}>
                {isSuperAdmin ? 'Super admin' : (admin?.roles ?? []).map((r) => r.name).join(', ') || 'No role'}
              </Typography>
            </Box>
          )}

          {/* Toggle Button - Different icons for collapsed/expanded */}
          <Tooltip 
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            placement="right"
            arrow
          >
            <IconButton
              onClick={sidebar.toggleCollapse}
              size="small"
              sx={{
                flexShrink: 0,
                bgcolor: isCollapsed ? alpha('#667eea', 0.1) : 'background.paper',
                border: '1px solid',
                borderColor: isCollapsed ? '#667eea' : 'divider',
                width: 28,
                height: 28,
                color: isCollapsed ? '#667eea' : 'text.secondary',
                '&:hover': {
                  bgcolor: isCollapsed ? alpha('#667eea', 0.2) : 'action.hover',
                  transform: 'scale(1.1)',
                  borderColor: '#667eea',
                },
                transition: 'all 200ms ease',
              }}
            >
              {isCollapsed ? (
                <MenuOpenIcon sx={{ fontSize: 16 }} />
              ) : (
                <MenuIcon2 sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: tokens.surface }}>
      {/*
        Shopify's top bar is near-black and full width, with the store name on
        the left and a search field taking the middle. It is the frame the rest
        of the chrome hangs off, so it stays dark even though everything below
        is light.
      */}
      <AppBar
        elevation={0}
        sx={{ position: 'fixed', zIndex: (t) => t.zIndex.drawer + 1, bgcolor: tokens.topbar }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: `${TOPBAR_HEIGHT}px !important`, px: { xs: 1.5, md: 2 } }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ display: { md: 'none' }, color: '#E3E3E3' }}
            aria-label="Toggle navigation"
          >
            <MenuIcon />
          </IconButton>

          {/* The wordmark lives here, not in the rail — Shopify puts the store
              identity in the dark bar and gives the nav its full height. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ 
              alignItems: 'center', 
              width: { md: drawerWidth - 32 }, 
              flexShrink: 0,
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* The store's own name, which is also the switch to another store. */}
            <StoreSwitcher compact={isCollapsed} />
          </Stack>

          <Box
            sx={{
              flex: 1,
              maxWidth: 520,
              mx: 'auto',
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 1,
              bgcolor: '#303030',
              border: '1px solid #616161',
              borderRadius: '8px',
              px: 1.25,
              height: 32,
              '&:focus-within': { borderColor: '#8A8A8A', bgcolor: '#3D3D3D' },
            }}
          >
            <SearchIcon sx={{ fontSize: 17, color: '#B5B5B5' }} />
            <InputBase
              placeholder="Search"
              inputProps={{ 'aria-label': 'Search the admin' }}
              sx={{ flex: 1, color: '#E3E3E3', fontSize: 13, '& input::placeholder': { color: '#B5B5B5', opacity: 1 } }}
            />
          </Box>

          <Box sx={{ flex: { xs: 1, sm: 0 } }} />

          <Tooltip title={admin?.email ?? ''}>
            <IconButton onClick={(event) => setAnchor(event.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar
                sx={{ width: 26, height: 26, bgcolor: '#5C5C5C', fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}
              >
                {initials || '?'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem
              onClick={async () => {
                setAnchor(null)
                await logout()
                navigate('/login', { replace: true })
              }}
            >
              <ListItemIcon>
                <LogoutIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/*
        Labelled because it is not the only nav landmark on the page — MUI's
        Pagination renders one too, so a screen reader listing landmarks would
        otherwise offer two unnamed "navigation" regions and no way to tell the
        sidebar from a page's pager.
      */}
      <Box
        component="nav"
        aria-label="Main"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: tokens.rail },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              border: 0,
              bgcolor: tokens.rail,
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar sx={{ minHeight: `${TOPBAR_HEIGHT}px !important` }} />
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 3 }, pb: 6 }}>
        <Toolbar sx={{ minHeight: `${TOPBAR_HEIGHT}px !important` }} />
        <Box
          sx={{
            maxWidth: FULL_BLEED_ROUTES.some((route) => location.pathname.startsWith(route)) ? 'none' : CONTENT_MAX,
            mx: 'auto',
            pt: 3,
          }}
        >
          <StoreStatusBanner />
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
