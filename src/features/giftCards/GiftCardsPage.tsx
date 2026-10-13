import AddIcon from '@mui/icons-material/Add'
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  LinearProgress,
  Pagination,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { useFlash } from '../../hooks/useFlash'
import { formatDate, formatMoneyIn } from '../../lib/format'
import { GiftCardDrawer } from './GiftCardDrawer'
import { giftCardKeys, STATE, type GiftCardList } from './giftCardTypes'
import { IssueGiftCardDialog } from './IssueGiftCardDialog'

const TABS = [
  { value: '', label: 'All' },
  { value: 'enabled', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'expired', label: 'Expired' },
  { value: 'disabled', label: 'Disabled' },
] as const

/**
 * Products → Gift cards: every card the store has issued or sold, what is
 * still outstanding on them, and issuing new ones. Staff see a card's last
 * four characters only; the full code is shown once, when it is issued.
 */
export function GiftCardsPage() {
  const { can } = useAuth()
  const canManage = can('gift_cards.manage')
  const { flash, success, clear } = useFlash()
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim(), 300)
  const [page, setPage] = useState(1)
  const [issuing, setIssuing] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const params = { status: status || undefined, q: search || undefined, page, limit: 25 }
  const list = useQuery({ queryKey: giftCardKeys.list(params), queryFn: () => api.get<GiftCardList>('/gift-cards', params), placeholderData: keepPreviousData })
  const rows = list.data?.gift_cards ?? []
  const summary = list.data?.summary

  return (
    <Box>
      <PageHeader
        title="Gift cards"
        subtitle={summary ? `${summary.issued.toLocaleString()} issued · ${formatMoneyIn(summary.outstanding, summary.currency)} outstanding` : undefined}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIssuing(true)}>
              Issue gift card
            </Button>
          )
        }
      />

      <Card variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ px: 2, pt: 1, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Tabs
            value={status}
            onChange={(_event, next: string) => {
              setStatus(next)
              setPage(1)
            }}
            variant="scrollable"
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>
          <TextField
            size="small"
            placeholder="Last 4 characters, customer, order"
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 280, pb: { xs: 1, md: 0 } }}
          />
        </Stack>
        {list.isFetching && <LinearProgress sx={{ height: 2 }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Issued</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((card) => (
                <TableRow key={card.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(card.id)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {card.masked_code}
                    </Typography>
                    {card.source === 'purchase' && (
                      <Typography variant="caption" color="text.secondary">
                        Bought{card.order?.order_number ? ` on ${card.order.order_number}` : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={STATE[card.state].label} color={STATE[card.state].color} />
                  </TableCell>
                  <TableCell>{card.customer?.name || card.customer?.email || card.recipient?.email || '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {formatMoneyIn(card.balance, card.currency)}
                    <Typography variant="caption" color="text.secondary" component="div">
                      of {formatMoneyIn(card.initial_value, card.currency)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{card.expires_on ? formatDate(card.expires_on) : 'Never'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(card.created_at)}</TableCell>
                </TableRow>
              ))}
              {!list.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
                      <CardGiftcardOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
                      <Typography variant="subtitle1">{search || status ? 'No gift cards match' : 'No gift cards yet'}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, textAlign: 'center' }}>
                        Issue one to say thank you or make up for a problem, or sell them: mark a product as a gift card and each one bought is issued and emailed when the order is paid.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {(list.data?.pagination.total_pages ?? 1) > 1 && (
          <Stack sx={{ alignItems: 'center', py: 2 }}>
            <Pagination count={list.data!.pagination.total_pages} page={page} onChange={(_event, next) => setPage(next)} />
          </Stack>
        )}
      </Card>

      {issuing && (
        <IssueGiftCardDialog
          onClose={() => setIssuing(false)}
          onIssued={(card) => {
            setIssuing(false)
            success(`${card.masked_code} issued`)
          }}
        />
      )}
      <GiftCardDrawer id={open} canManage={canManage} onClose={() => setOpen(null)} onChanged={success} />
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}
