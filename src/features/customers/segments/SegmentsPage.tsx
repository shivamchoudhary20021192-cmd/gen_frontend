import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Paper,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PeopleIcon from '@mui/icons-material/People'
import FilterListIcon from '@mui/icons-material/FilterList'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { segmentsApi, type Segment } from '../../../api/segments'
import { tokens } from '../../../theme'

export function SegmentsPage() {
  const navigate = useNavigate()
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    loadSegments()
  }, [typeFilter, search]) // Auto-search when search or typeFilter changes

  const loadSegments = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (search) params.search = search
      if (typeFilter !== 'all') params.segment_type = typeFilter

      const response = await segmentsApi.list(params)
      setSegments(response.segments)
    } catch (error) {
      console.error('Failed to load segments:', error)
    } finally {
      setLoading(false)
    }
  }



  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this segment?')) return

    try {
      await segmentsApi.delete(id)
      loadSegments()
    } catch (error) {
      console.error('Failed to delete segment:', error)
      alert('Failed to delete segment')
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'auto':
        return 'success'
      case 'manual':
        return 'primary'
      case 'imported':
        return 'warning'
      default:
        return 'default'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={0} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: tokens.inkStrong, mb: 0.5 }}>
            Customer Segments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading...' : `${segments.length} total`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/segments/new')}
          sx={{
            bgcolor: tokens.inkStrong,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 500,
            px: 2.5,
            py: 1,
            borderRadius: 1.5,
            '&:hover': { bgcolor: '#000' },
          }}
        >
          Create Segment
        </Button>
      </Stack>

      {/* Filters Card */}
      <Paper elevation={0} sx={{ mb: 3, p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <TextField
            label="Search"
            placeholder="Search segments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: 320 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
              startAdornment={
                <FilterListIcon fontSize="small" sx={{ ml: 0.5, mr: -0.5, color: 'text.secondary' }} />
              }
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="imported">Imported</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                <TableCell sx={{ fontWeight: 600, color: tokens.inkStrong }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.inkStrong }}>Type</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: tokens.inkStrong }}>
                  Customers
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.inkStrong }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.inkStrong }}>Last Calculated</TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.inkStrong }}>Created By</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: tokens.inkStrong }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : segments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 10, bgcolor: 'rgba(245, 245, 245, 0.3)' }}>
                    <Box>
                      <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography color="text.secondary" gutterBottom>
                        No segments found
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/segments/new')}
                        sx={{ mt: 2 }}
                      >
                        Create your first segment
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                segments.map((segment, index) => (
                  <TableRow
                    key={segment.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      borderBottom: index === segments.length - 1 ? 0 : '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.04)' },
                    }}
                    onClick={() => navigate(`/segments/${segment.id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        {segment.color && (
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: segment.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Typography sx={{ fontWeight: 600, color: tokens.inkStrong }}>
                          {segment.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={segment.segment_type.toUpperCase()}
                        size="small"
                        color={getTypeColor(segment.segment_type) as any}
                        sx={{ fontWeight: 700, fontSize: 10, height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                        <PeopleIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 600, color: tokens.inkStrong }}>
                          {segment.customer_count}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {segment.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(segment.last_calculated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {segment.created_by_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/segments/${segment.id}`)}
                            sx={{
                              '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.08)', color: tokens.ink },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/segments/${segment.id}/edit`)}
                            sx={{
                              '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.08)', color: tokens.ink },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(segment.id)}
                            sx={{
                              '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.08)', color: '#f44336' },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Stats */}
      {!loading && segments.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Paper
            elevation={0}
            sx={{ p: 3, flex: 1, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
              Total Segments
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: tokens.inkStrong }}>
              {segments.length}
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{ p: 3, flex: 1, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
              Total Customers
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: tokens.inkStrong }}>
              {segments.reduce((sum, s) => sum + s.customer_count, 0)}
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{ p: 3, flex: 1, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
              Auto Segments
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: tokens.inkStrong }}>
              {segments.filter((s) => s.segment_type === 'auto').length}
            </Typography>
          </Paper>
        </Stack>
      )}
    </Box>
  )
}