import { Box, Button, Typography } from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'

export function RedirectFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/content/redirects')}
        >
          Back to Redirects
        </Button>
        <Typography variant="h4" component="h1">
          {isNew ? 'Create Redirect' : 'Edit Redirect'}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Redirect form coming soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure URL redirects with rules and conditions
        </Typography>
      </Box>
    </Box>
  )
}
