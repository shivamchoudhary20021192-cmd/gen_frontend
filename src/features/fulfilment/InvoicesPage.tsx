import DownloadIcon from '@mui/icons-material/Download'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { formatDate, formatMoney } from '../../lib/format'
import { useInvoiceList, useIssueCreditNote, type Invoice } from './useFulfilment'

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

/** The first day of the current month, as the default "this period" filter. */
function monthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams()
  const [creditFor, setCreditFor] = useState<Invoice | null>(null)

  const type = params.get('type') ?? ''
  const search = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed === search) return
      update({ q: trimmed || undefined })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const query = useMemo(
    () => ({
      page,
      limit: 50,
      q: search || undefined,
      type: type || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, search, type, from, to],
  )

  const list = useInvoiceList(query)
  const rows = list.data?.invoices ?? []
  const pagination = list.data?.pagination
  const summary = list.data?.summary

  return (
    <Box>
      <PageHeader
        title="Invoices"
        subtitle={pagination ? `${pagination.total} documents` : undefined}
        actions={
          <Button size="small" variant="outlined" onClick={() => update({ from: monthStart(), to: undefined })}>
            This month
          </Button>
        }
      />

      {/*
        The GSTR-1 figures, net of credit notes. This is the number someone
        copies into a filing, so it is stated at the top rather than left to be
        added up from the table.
      */}
      {summary && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              {(
                [
                  ['Documents', String(summary.invoice_count)],
                  ['Taxable value', formatMoney(summary.taxable_value)],
                  ['CGST', formatMoney(summary.cgst)],
                  ['SGST', formatMoney(summary.sgst)],
                  ['IGST', formatMoney(summary.igst)],
                  ['Invoiced', formatMoney(summary.total)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <Grid key={label} size={{ xs: 6, sm: 4, md: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.25 }}>
                    {value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Net of credit notes, for the filters below.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
          <TextField
            label="Search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search invoice number, order or phone"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            label="Type"
            value={type}
            onChange={(event) => update({ type: event.target.value || undefined })}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All documents</MenuItem>
            <MenuItem value="tax_invoice">Tax invoices</MenuItem>
            <MenuItem value="credit_note">Credit notes</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={(event) => update({ from: event.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={(event) => update({ to: event.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
        </Stack>
      </Card>

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : list.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load invoices.
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              No invoices in this range.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              An invoice is issued from the order once it has been confirmed.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>Place of supply</TableCell>
                  <TableCell align="right">Taxable</TableCell>
                  <TableCell align="right">Tax</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((invoice) => (
                  <TableRow key={invoice.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {invoice.invoice_number}
                        </Typography>
                        {invoice.invoice_type === 'credit_note' && (
                          <Chip size="small" color="warning" label="Credit note" sx={{ height: 18, fontSize: 10 }} />
                        )}
                      </Stack>
                      {invoice.against_invoice && (
                        <Typography variant="caption" color="text.secondary">
                          against {invoice.against_invoice}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <MuiLink component={Link} to={`/orders/${invoice.order.id}`} variant="body2">
                        {invoice.order.order_number}
                      </MuiLink>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {invoice.customer.name ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{invoice.place_of_supply_name ?? '—'}</Typography>
                      {/* The split is the thing an auditor checks first. */}
                      <Chip
                        size="small"
                        label={invoice.is_inter_state ? 'IGST' : 'CGST + SGST'}
                        sx={{ height: 17, fontSize: 10, mt: 0.25 }}
                      />
                    </TableCell>
                    <TableCell align="right">{formatMoney(invoice.taxable_value)}</TableCell>
                    <TableCell align="right">
                      <Tooltip
                        title={
                          invoice.is_inter_state
                            ? `IGST ${formatMoney(invoice.igst)}`
                            : `CGST ${formatMoney(invoice.cgst)} · SGST ${formatMoney(invoice.sgst)}`
                        }
                      >
                        <span>{formatMoney(invoice.tax_total)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatMoney(invoice.total_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        {invoice.pdf_url && (
                          <Button
                            size="small"
                            href={invoice.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                          >
                            PDF
                          </Button>
                        )}
                        {invoice.invoice_type === 'tax_invoice' && (
                          <Button size="small" color="error" onClick={() => setCreditFor(invoice)}>
                            Credit
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {pagination && pagination.pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination
              count={pagination.pages}
              page={pagination.page}
              onChange={(_event, value) => update({ page: String(value) })}
              size="small"
            />
          </Box>
        )}
      </Card>

      <CreditNoteDialog invoice={creditFor} onClose={() => setCreditFor(null)} />
    </Box>
  )
}

/**
 * A credit note against an issued invoice.
 *
 * Under GST an issued invoice cannot be edited, so a refund is reversed with
 * its own numbered document rather than by amending the original. The dialog
 * says so, because the instinct is to look for an "edit invoice" button.
 */
function CreditNoteDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const issue = useIssueCreditNote()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.total_amount))
      setReason('')
      setError(null)
    }
  }, [invoice])

  if (!invoice) return null
  const parsed = Number(amount || 0)
  const overTotal = parsed > invoice.total_amount

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Credit note against {invoice.invoice_number}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          An issued invoice cannot be changed. This raises a separate numbered document that reverses part or
          all of it, and it inherits the invoice's {invoice.is_inter_state ? 'IGST' : 'CGST/SGST'} split.
        </Alert>
        <Stack spacing={2}>
          <TextField
            label="Amount to credit"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
            error={overTotal}
            helperText={
              overTotal
                ? `More than the invoice total of ${formatMoney(invoice.total_amount)}`
                : `Invoice total is ${formatMoney(invoice.total_amount)}`
            }
            fullWidth
            slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Damaged in transit, refunded in full"
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          disabled={issue.isPending || overTotal || parsed <= 0 || reason.trim().length < 3}
          onClick={() => {
            setError(null)
            issue.mutate(
              { invoiceId: invoice.id, amount: parsed, reason: reason.trim() },
              { onSuccess: onClose, onError: (caught) => setError(errorText(caught)) },
            )
          }}
        >
          {issue.isPending ? 'Issuing…' : 'Issue credit note'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
