import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  Switch,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import VerifiedIcon from '@mui/icons-material/Verified'
import ReplyIcon from '@mui/icons-material/Reply'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import {
  REVIEW_STATUS_META,
  SORT_OPTIONS,
  STATUS_ACTIONS,
  STATUS_FILTERS,
  ageRangeLabel,
  usageDurationLabel,
} from './reviewMeta'
import {
  errorMessage,
  useChangeReviewStatus,
  useReplyToReview,
  useReviews,
  type AdminReview,
} from './useReviews'

const ROWS_PER_PAGE = [10, 25, 50]

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── decision dialog ──────────────────────────────────────────────────────────

interface DecisionProps {
  review: AdminReview
  status: string
  onClose: () => void
}

function DecisionDialog({ review, status, onClose }: DecisionProps) {
  const action = STATUS_ACTIONS[status]
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const change = useChangeReviewStatus()

  const submit = () => {
    setError(null)
    if (action?.needsReason && !reason.trim()) {
      setError('Give a reason — it is kept with the review as the record of why.')
      return
    }
    change.mutate(
      { id: review.id, status, reason: reason.trim() || undefined, note: note.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (caught) => setError(errorMessage(caught, 'The decision was refused.')),
      },
    )
  }

  return (
    <Dialog open onClose={change.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {action?.label ?? status} — {review.author_name}&rsquo;s review
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {review.product.name}
            </Typography>
            <Rating value={review.rating} readOnly size="small" sx={{ mt: 0.5 }} />
            {review.title && (
              <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                {review.title}
              </Typography>
            )}
            {review.body && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {review.body}
              </Typography>
            )}
          </Box>

          {review.flagged_adverse_reaction && (
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              This review describes a possible skin reaction. Consider whether it needs to be
              recorded as an adverse event and whether the customer should be contacted, regardless
              of what you decide about publishing it.
            </Alert>
          )}

          {status === 'approved' && (
            <Alert severity="info">
              Publishing this counts it towards {review.product.name}&rsquo;s rating immediately.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {action?.needsReason && (
            <TextField
              label="Reason for rejecting"
              placeholder="e.g. Not about this product, or contains another customer's personal details"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              fullWidth
              size="small"
              required
            />
          )}

          <TextField
            label="Internal note (optional)"
            placeholder="Only staff see this"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={change.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={change.isPending}>
          {action?.label ?? 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── reply dialog ─────────────────────────────────────────────────────────────

function ReplyDialog({ review, onClose }: { review: AdminReview; onClose: () => void }) {
  const [body, setBody] = useState('')
  const [displayName, setDisplayName] = useState('Veylor')
  const [error, setError] = useState<string | null>(null)
  const reply = useReplyToReview()

  const submit = () => {
    setError(null)
    if (body.trim().length < 2) {
      setError('Write a reply.')
      return
    }
    reply.mutate(
      { id: review.id, body: body.trim(), display_name: displayName.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (caught) => setError(errorMessage(caught, 'The reply was refused.')),
      },
    )
  }

  return (
    <Dialog open onClose={reply.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reply to {review.author_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="info">This reply is public, shown under the review on the product page.</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Replying as"
            placeholder="e.g. Veylor, or Priya from Veylor"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Reply"
            placeholder="Thank them, answer the question, or explain what you have changed."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={4}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={reply.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={reply.isPending}>
          Post reply
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── one review ───────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onDecide,
  onReply,
}: {
  review: AdminReview
  onDecide: (status: string) => void
  onReply: () => void
}) {
  const meta = REVIEW_STATUS_META[review.status]
  const facts = [
    usageDurationLabel(review.usage_duration),
    ageRangeLabel(review.age_range),
    review.variant_title,
    review.author_location,
  ].filter(Boolean)

  return (
    <Paper
      variant="outlined"
      // A stable hook for one card. Every surrounding element is also an
      // outlined Paper, so text filtering alone cannot tell a card from the
      // list that contains it.
      data-testid="review-card"
      data-review-id={review.id}
      sx={{
        p: 2,
        // A safety signal should look like one before it is read.
        borderColor: review.flagged_adverse_reaction ? 'warning.main' : undefined,
        borderWidth: review.flagged_adverse_reaction ? 2 : 1,
      }}
    >
      <Stack spacing={1.5}>
        {review.flagged_adverse_reaction && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ py: 0.5 }}>
            Mentions a possible skin reaction — read before deciding.
          </Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Rating value={review.rating} readOnly size="small" />
              <Tooltip title={meta.help}>
                <Chip label={meta.label} color={meta.colour} size="small" />
              </Tooltip>
              {review.is_verified_purchase && (
                <Tooltip title="Matched to a delivered order containing this product">
                  <Chip
                    icon={<VerifiedIcon />}
                    label="Verified purchase"
                    size="small"
                    variant="outlined"
                    color="success"
                  />
                </Tooltip>
              )}
              {review.open_reports > 0 && (
                <Chip label={`${review.open_reports} reported`} size="small" color="error" variant="outlined" />
              )}
            </Stack>

            <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
              {review.product.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {review.author_name}
              {review.order_number ? ` · order ${review.order_number}` : ''} ·{' '}
              {formatDateTime(review.created_at)}
            </Typography>
          </Box>
        </Stack>

        {review.title && (
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {review.title}
          </Typography>
        )}
        {review.body && <Typography variant="body2">{review.body}</Typography>}

        {facts.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {facts.map((fact) => (
              <Chip key={fact} label={fact} size="small" variant="outlined" />
            ))}
            {review.would_recommend !== null && (
              <Chip
                label={review.would_recommend ? 'Would recommend' : 'Would not recommend'}
                size="small"
                variant="outlined"
                color={review.would_recommend ? 'success' : 'default'}
              />
            )}
          </Stack>
        )}

        {review.reply && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              {review.reply.author} replied
            </Typography>
            <Typography variant="body2">{review.reply.body}</Typography>
          </Paper>
        )}

        {(review.rejection_reason || review.moderation_note) && (
          <Box>
            {review.rejection_reason && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                Rejected: {review.rejection_reason}
              </Typography>
            )}
            {review.moderation_note && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Note: {review.moderation_note}
              </Typography>
            )}
            {review.moderated_by && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                by {review.moderated_by} · {formatDateTime(review.moderated_at)}
              </Typography>
            )}
          </Box>
        )}

        <Divider />

        {/* Buttons come from next_statuses, so an illegal move is absent rather
            than present-and-refused. */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {review.next_statuses.map((status) => {
            const action = STATUS_ACTIONS[status]
            if (!action) return null
            return (
              <Button
                key={status}
                size="small"
                variant={status === 'approved' ? 'contained' : 'outlined'}
                color={action.colour === 'inherit' ? 'inherit' : action.colour}
                onClick={() => onDecide(status)}
              >
                {action.label}
              </Button>
            )
          })}
          {review.status === 'approved' && !review.reply && (
            <Button size="small" startIcon={<ReplyIcon />} onClick={onReply}>
              Reply
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const [status, setStatus] = useState('pending')
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(10)
  const [deciding, setDeciding] = useState<{ review: AdminReview; status: string } | null>(null)
  const [replying, setReplying] = useState<AdminReview | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const params = useMemo(
    () => ({
      page: page + 1,
      limit,
      status,
      sort,
      q: debouncedSearch || undefined,
      flagged: flaggedOnly || undefined,
    }),
    [page, limit, status, sort, debouncedSearch, flaggedOnly],
  )

  const { data, isLoading, isFetching, error } = useReviews(params)
  const reviews = data?.reviews ?? []
  const counts = data?.counts ?? {}

  const resetPage = () => setPage(0)

  return (
    <Box>
      <PageHeader
        title="Reviews"
        subtitle="Written by verified buyers, published only once you approve them"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(error, 'Reviews could not be loaded.')}</Alert>}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: 'center' } }}
      >
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            resetPage()
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          {STATUS_FILTERS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.value === 'pending' && (counts.pending ?? 0) > 0 ? (
                <Badge badgeContent={counts.pending} color="warning" sx={{ pr: 2 }}>
                  {option.label}
                </Badge>
              ) : (
                option.label
              )}
            </MenuItem>
          ))}
        </Select>

        <Select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value)
            resetPage()
          }}
          size="small"
          sx={{ minWidth: 180 }}
        >
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>

        <TextField
          placeholder="Search product, author or wording"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            resetPage()
          }}
          size="small"
          fullWidth
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

        <FormControlLabel
          control={
            <Switch
              checked={flaggedOnly}
              onChange={(event) => {
                setFlaggedOnly(event.target.checked)
                resetPage()
              }}
            />
          }
          label="Possible reactions only"
          sx={{ whiteSpace: 'nowrap' }}
        />
      </Stack>

      <Paper variant="outlined">
        {isFetching && <LinearProgress />}
        <Box sx={{ p: 2 }}>
          {isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Loading reviews…
            </Typography>
          ) : reviews.length === 0 ? (
            <Stack spacing={1} sx={{ py: 5, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {status === 'pending'
                  ? 'Nothing waiting. New reviews land here for approval before they go live.'
                  : 'No reviews match these filters.'}
              </Typography>
              {status === 'pending' && (counts.approved ?? 0) === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Reviews can only be written by someone whose order was delivered, so the first
                  ones arrive after your first deliveries.
                </Typography>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onDecide={(next) => setDeciding({ review, status: next })}
                  onReply={() => setReplying(review)}
                />
              ))}
            </Stack>
          )}
        </Box>
        <TablePagination
          component="div"
          count={data?.pagination.total ?? 0}
          page={page}
          onPageChange={(_event, next) => setPage(next)}
          rowsPerPage={limit}
          rowsPerPageOptions={ROWS_PER_PAGE}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value))
            resetPage()
          }}
        />
      </Paper>

      {deciding && (
        <DecisionDialog
          review={deciding.review}
          status={deciding.status}
          onClose={() => setDeciding(null)}
        />
      )}
      {replying && <ReplyDialog review={replying} onClose={() => setReplying(null)} />}
    </Box>
  )
}
