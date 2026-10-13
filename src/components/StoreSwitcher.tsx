import AddBusinessIcon from '@mui/icons-material/AddBusiness'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import { Box, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShop } from '../shop/useShop'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { useOperator } from '../features/console/useOperator'

/**
 * The store name in the top bar, which is also the way to another store —
 * Shopify's store switcher. It lists every store this person is on the staff
 * of, links to the current store's details and storefront, and opens a new
 * store.
 */
export function StoreSwitcher({ compact }: { compact: boolean }) {
  const { summary, memberships, switchTo } = useShop()
  const navigate = useNavigate()
  const { isOperator } = useOperator()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [switching, setSwitching] = useState<number | null>(null)
  const shop = summary?.shop

  const current = memberships.find((membership) => membership.handle === shop?.handle)
  const others = memberships.filter((membership) => membership.handle !== shop?.handle && membership.member_status === 'active')

  return (
    <>
      <ButtonBase
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-label="Switch store"
        sx={{ borderRadius: 1.5, px: 1, py: 0.5, gap: 1, minWidth: 0, color: '#FFFFFF', '&:hover': { bgcolor: '#303030' } }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: 1,
            bgcolor: '#4A4A4A',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(shop?.name ?? 'V').charAt(0).toUpperCase()}
        </Box>
        {!compact && (
          <Typography noWrap sx={{ fontWeight: 650, fontSize: 13, maxWidth: 150 }}>
            {shop?.name ?? 'Loading…'}
          </Typography>
        )}
        <ExpandMoreIcon sx={{ fontSize: 16, color: '#B5B5B5' }} />
      </ButtonBase>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 260, mt: 0.5 } } }}
      >
        {shop && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle1">{shop.name}</Typography>
            <Typography variant="caption">{shop.primary_domain ?? `${shop.handle}`}</Typography>
          </Box>
        )}
        {current && (
          <MenuItem disabled dense>
            <ListItemIcon>
              <CheckIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText primary={current.name} secondary={current.is_owner ? 'Owner' : 'Staff'} />
          </MenuItem>
        )}
        {others.map((membership) => (
          <MenuItem
            key={membership.shop_id}
            dense
            disabled={switching !== null}
            onClick={async () => {
              setSwitching(membership.shop_id)
              try {
                await switchTo(membership.shop_id)
              } finally {
                setSwitching(null)
              }
            }}
          >
            <ListItemIcon />
            <ListItemText
              primary={membership.name}
              secondary={switching === membership.shop_id ? 'Switching…' : membership.status !== 'active' ? membership.status : membership.handle}
            />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          dense
          onClick={() => {
            setAnchor(null)
            navigate('/settings/store')
          }}
        >
          <ListItemIcon>
            <SettingsIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
          Store details
        </MenuItem>
        {shop && (
          <MenuItem dense component="a" href={shop.storefront_url} target="_blank" rel="noopener noreferrer" onClick={() => setAnchor(null)}>
            <ListItemIcon>
              <OpenInNewIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            View your store
          </MenuItem>
        )}
        <MenuItem
          dense
          onClick={() => {
            setAnchor(null)
            navigate('/stores/new')
          }}
        >
          <ListItemIcon>
            <AddBusinessIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
          Create another store
        </MenuItem>
        {isOperator && <Divider />}
        {isOperator && (
          <MenuItem
            dense
            onClick={() => {
              setAnchor(null)
              navigate('/console')
            }}
          >
            <ListItemIcon>
              <AdminPanelSettingsIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            Platform console
          </MenuItem>
        )}
      </Menu>
    </>
  )
}
