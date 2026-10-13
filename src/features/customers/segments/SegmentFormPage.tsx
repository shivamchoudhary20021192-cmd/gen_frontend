import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { segmentsApi } from '../../../api/segments'

const PRESET_COLORS = [
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#795548', // Brown
  '#607D8B', // Blue Grey
]

export function SegmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [segmentType, setSegmentType] = useState<'manual' | 'auto' | 'imported'>('manual')
  const [color, setColor] = useState('#9C27B0')
  const [icon, setIcon] = useState('segment')

  useEffect(() => {
    if (isEdit) {
      loadSegment()
    }
  }, [id])

  const loadSegment = async () => {
    try {
      setLoading(true)
      const response = await segmentsApi.get(Number(id))
      const segment = response.segment
      setName(segment.name)
      setDescription(segment.description || '')
      setSegmentType(segment.segment_type)
      setColor(segment.color || '#9C27B0')
      setIcon(segment.icon || 'segment')
    } catch (error) {
      console.error('Failed to load segment:', error)
      alert('Failed to load segment')
      navigate('/segments')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      alert('Please enter a segment name')
      return
    }

    try {
      setSaving(true)
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        segment_type: segmentType,
        color,
        icon,
      }

      if (isEdit) {
        await segmentsApi.update(Number(id), data)
      } else {
        const result = await segmentsApi.create(data)
        navigate(`/segments/${result.id}`)
        return
      }

      navigate(`/segments/${id}`)
    } catch (error: any) {
      console.error('Failed to save segment:', error)
      alert(error.response?.data?.message || 'Failed to save segment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/customers/segments')}
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.04)',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {isEdit ? 'Edit Segment' : 'Create Segment'}
        </Typography>
      </Stack>

      {/* Form */}
      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {/* Name */}
              <TextField
                label="Segment Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                placeholder="e.g., VIP Customers"
                helperText="A descriptive name for this customer segment"
              />

              {/* Description */}
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={4}
                placeholder="Describe what makes this segment unique..."
                helperText="Optional description to help your team understand this segment"
              />

              <Divider />

              {/* Type */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                  Segment Type *
                </Typography>
                <Stack spacing={2}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      borderWidth: 2,
                      borderColor: segmentType === 'manual' ? 'primary.main' : 'divider',
                      bgcolor: segmentType === 'manual' ? 'rgba(33, 150, 243, 0.04)' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'rgba(33, 150, 243, 0.04)',
                      },
                    }}
                    onClick={() => setSegmentType('manual')}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Radio
                          checked={segmentType === 'manual'}
                          value="manual"
                          onChange={(e) => setSegmentType(e.target.value as any)}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Manual
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Manually add/remove customers from this segment
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card
                    variant="outlined"
                    sx={{
                      borderWidth: 2,
                      opacity: 0.5,
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Radio disabled checked={false} value="auto" />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} color="text.disabled">
                            Auto (Coming Soon)
                          </Typography>
                          <Typography variant="body2" color="text.disabled">
                            Automatically add customers based on rules (requires backend setup)
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      borderWidth: 2,
                      borderColor: segmentType === 'imported' ? 'primary.main' : 'divider',
                      bgcolor: segmentType === 'imported' ? 'rgba(33, 150, 243, 0.04)' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'rgba(33, 150, 243, 0.04)',
                      },
                    }}
                    onClick={() => setSegmentType('imported')}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Radio
                          checked={segmentType === 'imported'}
                          value="imported"
                          onChange={(e) => setSegmentType(e.target.value as any)}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Imported
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Import customer list from CSV or external source
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Box>

              <Divider />

              {/* Color */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                  Color
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((presetColor) => (
                    <Box
                      key={presetColor}
                      onClick={() => setColor(presetColor)}
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: presetColor,
                        cursor: 'pointer',
                        border: '3px solid',
                        borderColor: color === presetColor ? '#1a1a1a' : 'transparent',
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: 2,
                        },
                      }}
                    >
                      {color === presetColor && (
                        <CheckCircleIcon
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            color: '#1a1a1a',
                            bgcolor: 'white',
                            borderRadius: '50%',
                            fontSize: 20,
                          }}
                        />
                      )}
                    </Box>
                  ))}
                  <TextField
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    size="small"
                    sx={{ width: 140 }}
                    placeholder="#9C27B0"
                    label="Custom"
                  />
                </Stack>
              </Box>

              {/* Icon */}
              <TextField
                label="Icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                fullWidth
                placeholder="segment"
                helperText="Material icon name (e.g., star, diamond, segment)"
              />

              {/* Actions */}
              <Stack
                direction="row"
                spacing={2}
                sx={{ justifyContent: 'flex-end', pt: 2 }}
              >
                <Button
                  variant="outlined"
                  onClick={() => navigate('/customers/segments')}
                  disabled={saving}
                  sx={{ minWidth: 120 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  disabled={saving}
                  sx={{ minWidth: 160 }}
                >
                  {isEdit ? 'Save Changes' : 'Create Segment'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}