import { Box, Button, Typography } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

export function RedirectsListPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Redirects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/content/redirects/new')}
        >
          Create Redirect
        </Button>
      </Box>

      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Redirects module coming soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create and manage URL redirects (301, 302)
        </Typography>
      </Box>
    </Box>
  )
}
