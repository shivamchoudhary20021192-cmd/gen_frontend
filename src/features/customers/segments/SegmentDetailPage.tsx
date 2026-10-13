import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  Pagination,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
// import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import RefreshIcon from '@mui/icons-material/Refresh'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { segmentsApi, type Segment, type SegmentMember } from '../../../api/segments'

export function SegmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [segment, setSegment] = useState<Segment | null>(null)
  const [members, setMembers] = useState<SegmentMember[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (id) {
      loadSegment()
      loadMembers()
    }
  }, [id, page])

  const loadSegment = async () => {
    try {
      setLoading(true)
      const response = await segmentsApi.get(Number(id))
      setSegment(response.segment)
    } catch (error) {
      console.error('Failed to load segment:', error)
      alert('Failed to load segment')
      navigate('/segments')
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    try {
      setMembersLoading(true)
      const response = await segmentsApi.getMembers(Number(id), { page, limit: 50 })
      setMembers(response.data)
      setTotalPages(response.pagination.pages)
      setTotal(response.pagination.total)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setMembersLoading(false)
    }
  }

  const handleRemoveMember = async (customerId: number) => {
    if (!confirm('Remove this customer from the segment?')) return

    try {
      await segmentsApi.removeMember(Number(id), customerId)
      loadMembers()
      loadSegment() // Refresh count
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this segment? This cannot be undone.')) return

    try {
      await segmentsApi.delete(Number(id))
      navigate('/segments')
    } catch (error) {
      console.error('Failed to delete segment:', error)
      alert('Failed to delete segment')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!segment) return null

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/segments')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {segment.color && (
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: segment.color,
                }}
              />
            )}
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {segment.name}
            </Typography>
            <Chip
              label={segment.segment_type.toUpperCase()}
              size="small"
              color={segment.segment_type === 'auto' ? 'success' : 'primary'}
            />
          </Stack>
          {segment.description && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {segment.description}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          {segment.segment_type === 'auto' && (
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadMembers}>
              Recalculate
            </Button>
          )}
          {segment.segment_type === 'manual' && (
            <Button variant="outlined" startIcon={<PersonAddIcon />}>
              Add Customer
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/segments/${id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Stack>
      </Stack>

      {/* Stats Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Total Customers
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 600 }}>
            {segment.customer_count}
          </Typography>
        </Card>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Segment Type
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {segment.segment_type}
          </Typography>
        </Card>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last Calculated
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {formatDate(segment.last_calculated_at)}
          </Typography>
        </Card>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Created By
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {segment.created_by_name || 'System'}
          </Typography>
        </Card>
      </Stack>

      {/* Rules Card (for auto segments) */}
      {segment.segment_type === 'auto' && segment.rules && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }} gutterBottom>
            Segment Rules ({segment.rules_operator === 'all' ? 'AND' : 'OR'})
          </Typography>
          <Stack spacing={1}>
            {Array.isArray(segment.rules) ? (
              segment.rules.map((rule: any, index: number) => (
                <Chip
                  key={index}
                  label={`${rule.field} ${rule.operator} ${rule.value}`}
                  variant="outlined"
                  sx={{ width: 'fit-content' }}
                />
              ))
            ) : (
              <Typography color="text.secondary">No rules defined</Typography>
            )}
          </Stack>
        </Card>
      )}

      {/* Members Table */}
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Segment Members ({total})
            </Typography>
            {membersLoading && <CircularProgress size={20} />}
          </Stack>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell align="right">Orders</TableCell>
                <TableCell align="right">Total Spent</TableCell>
                <TableCell>Last Order</TableCell>
                <TableCell>Added On</TableCell>
                {segment.segment_type === 'manual' && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {membersLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No customers in this segment</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow
                    key={member.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/customers/${member.customer_id}`)}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>
                        {member.first_name || member.last_name
                          ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                          : 'No name'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {member.email || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {member.country_code} {member.phone}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 500 }}>{member.orders_count}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 500 }}>{formatCurrency(member.total_spent)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.last_order_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.added_at)}
                      </Typography>
                    </TableCell>
                    {segment.segment_type === 'manual' && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Remove from segment">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveMember(member.customer_id)}
                          >
                            <RemoveCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Card>
    </Box>
  )
}