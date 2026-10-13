import {
  Box,
  Card,
  Chip,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { platformApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { countryName, formatDate } from '../../lib/format'
import { consoleKeys, STATUS_CHIP, type ConsolePlan, type ConsoleShop, type ShopStatus } from './consoleTypes'

/** Every store on the platform: search by name, handle or owner; filter by status and plan. */
export function ConsoleStoresPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const plan = params.get('plan_id') ?? ''
  const page = Number(params.get('page') ?? '1')
  const search = useDebounce(q, 300)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const query = { q: search || undefined, status: status || undefined, plan_id: plan || undefined, page, limit: 25 }
  const shops = useQuery({
    queryKey: consoleKeys.shops(query),
    queryFn: () => platformApi.get<{ shops: ConsoleShop[]; pagination: { page: number; pages: number; total: number } }>('/shops', query),
    placeholderData: (previous) => previous,
  })
  const plans = useQuery({ queryKey: consoleKeys.plans, queryFn: () => platformApi.get<{ plans: ConsolePlan[] }>('/plans') })

  const list = shops.data?.shops ?? []
  const pagination = shops.data?.pagination

  return (
    <>
      <PageHeader title="Stores" subtitle={pagination ? `${pagination.total} store${pagination.total === 1 ? '' : 's'}` : undefined} />
      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="Search by name, address or owner email"
            value={q}
            onChange={(event) => set('q', event.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ flex: 1 }}
          />
          <TextField select size="small" label="Status" value={status} onChange={(event) => set('status', event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Any status</MenuItem>
            {(Object.keys(STATUS_CHIP) as ShopStatus[]).map((key) => (
              <MenuItem key={key} value={key}>
                {STATUS_CHIP[key].label}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Plan" value={plan} onChange={(event) => set('plan_id', event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Any plan</MenuItem>
            {(plans.data?.plans ?? []).map((entry) => (
              <MenuItem key={entry.id} value={String(entry.id)}>
                {entry.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Store</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Opened</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((shop) => (
              <TableRow key={shop.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/console/stores/${shop.id}`)}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {shop.name}
                  </Typography>
                  <Typography variant="caption">{shop.primary_domain ?? shop.handle}</Typography>
                </TableCell>
                <TableCell>{shop.owner_email ?? '—'}</TableCell>
                <TableCell>{shop.plan ?? '—'}</TableCell>
                <TableCell>
                  {countryName(shop.country_code)} · {shop.currency}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={STATUS_CHIP[shop.status].label} color={STATUS_CHIP[shop.status].color} />
                </TableCell>
                <TableCell align="right">{formatDate(shop.created_at)}</TableCell>
              </TableRow>
            ))}
            {list.length === 0 && !shops.isLoading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No stores match.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {pagination && pagination.pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination count={pagination.pages} page={page} onChange={(_event, next) => set('page', String(next))} size="small" />
          </Box>
        )}
      </Card>
    </>
  )
}
