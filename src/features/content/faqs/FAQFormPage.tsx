import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  Switch,
  TextField,
  Typography,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishedIcon,
  ThumbUp as ThumbUpIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { tokens } from '../../../theme'
import { RichTextEditor } from '../pages/RichTextEditor'
import {
  useFAQ,
  useFAQGroups,
  useCreateFAQ,
  useUpdateFAQ,
  usePublishFAQ,
  useUnpublishFAQ,
  type EntityType,
  type CreateFAQDto,
  type UpdateFAQDto,
  validateQuestion,
  validateAnswer,
  validateEntityRelation,
  getPublishedStatusLabel,
  getPublishedStatusColor,
  formatDateTime,
  ENTITY_TYPE_OPTIONS,
} from './index'

export function FAQFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new' || !id
  const faqId = isNew ? 0 : parseInt(id!, 10)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: faq, isLoading } = useFAQ(faqId)
  const { data: groupsData } = useFAQGroups({ limit: 100, is_active: true })

  const groups = groupsData?.data || []

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useCreateFAQ()
  const updateMutation = useUpdateFAQ()
  const publishMutation = usePublishFAQ()
  const unpublishMutation = useUnpublishFAQ()

  // ── Form State ─────────────────────────────────────────────────────────────
  const [groupId, setGroupId] = useState<number | ''>('')
  const [entityType, setEntityType] = useState<EntityType | ''>('')
  const [entityId, setEntityId] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [claimId, setClaimId] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<string>('0')
  const [isPublished, setIsPublished] = useState(false)
  const [isIndexable, setIsIndexable] = useState(true)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ── Load FAQ Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (faq) {
      setGroupId(faq.group_id || '')
      setEntityType(faq.entity_type || '')
      setEntityId(faq.entity_id?.toString() || '')
      setQuestion(faq.question || '')
      setAnswer(faq.answer || '')
      setClaimId(faq.claim_id?.toString() || '')
      setSortOrder((faq.sort_order ?? 0).toString())
      setIsPublished(faq.is_published ?? false)
      setIsIndexable(faq.is_indexable ?? true)
    }
  }, [faq])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    const questionError = validateQuestion(question)
    if (questionError) errors.question = questionError

    const answerError = validateAnswer(answer)
    if (answerError) errors.answer = answerError

    const entityError = validateEntityRelation(
      entityType || null,
      entityId ? Number(entityId) : null
    )
    if (entityError) errors.entity = entityError

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateForm()) {
      setErrorMessage('Please fix the validation errors before saving')
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    const data: CreateFAQDto | UpdateFAQDto = {
      group_id: groupId || null,
      entity_type: entityType || null,
      entity_id: entityId ? Number(entityId) : null,
      question,
      answer,
      claim_id: claimId ? Number(claimId) : null,
      sort_order: Number(sortOrder),
      is_published: isPublished,
      is_indexable: isIndexable,
    }

    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(data as CreateFAQDto)
        setSuccessMessage('FAQ created successfully')
        navigate(`/content/faqs/${created.id}`, { replace: true })
      } else {
        await updateMutation.mutateAsync({ id: faqId, data })
        setSuccessMessage('FAQ updated successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
      }
      setFieldErrors({})
      setErrorMessage(null)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save FAQ')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handlePublish = async () => {
    if (!faq) return
    try {
      await publishMutation.mutateAsync(faqId)
      setSuccessMessage('FAQ published successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to publish FAQ')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleUnpublish = async () => {
    if (!faq) return
    try {
      await unpublishMutation.mutateAsync(faqId)
      setSuccessMessage('FAQ unpublished successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to unpublish FAQ')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          borderBottom: `1px solid ${tokens.border}`,
          mx: -3,
          px: 3,
          py: 2,
          mb: 3,
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/content/faqs')}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              Back
            </Button>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {isNew ? 'Create FAQ' : 'Edit FAQ'}
            </Typography>
            {faq && (
              <Chip
                label={getPublishedStatusLabel(faq.is_published)}
                size="small"
                sx={{
                  bgcolor: getPublishedStatusColor(faq.is_published) + '20',
                  color: getPublishedStatusColor(faq.is_published),
                  fontWeight: 500,
                }}
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            {!isNew && faq && (
              <>
                {faq.is_published ? (
                  <Button
                    variant="outlined"
                    startIcon={<UnpublishedIcon />}
                    onClick={handleUnpublish}
                    disabled={unpublishMutation.isPending}
                    sx={{ borderRadius: 2 }}
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<PublishIcon />}
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                    sx={{ borderRadius: 2 }}
                  >
                    Publish
                  </Button>
                )}
              </>
            )}
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Success/Error Messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={5000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Main Form */}
      <Grid container spacing={3}>
        {/* Left Column - Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Question Field */}
            <Card sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Question
              </Typography>
              <TextField
                fullWidth
                label="Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                error={!!fieldErrors.question}
                helperText={fieldErrors.question || `${question.length}/500 characters`}
                placeholder="Enter your frequently asked question..."
                required
                slotProps={{ htmlInput: { maxLength: 500 } }}
                multiline
                rows={2}
              />
            </Card>

            {/* Answer Field with Rich Text Editor */}
            <Card sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Answer
              </Typography>
              <RichTextEditor
                content={answer}
                onChange={setAnswer}
                placeholder="Write a detailed answer to the question..."
                error={!!fieldErrors.answer}
                helperText={fieldErrors.answer}
              />
            </Card>

            {/* Metadata */}
            {!isNew && faq && (
              <Card sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Metadata
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThumbUpIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2">
                      <strong>Helpful Count:</strong> {faq.helpful_count}
                    </Typography>
                  </Box>
                  {faq.published_at && (
                    <Typography variant="body2">
                      <strong>Published:</strong> {formatDateTime(faq.published_at)}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Created:</strong> {formatDateTime(faq.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Last Updated:</strong> {formatDateTime(faq.updated_at)}
                  </Typography>
                </Stack>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* Right Column - Settings */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Organization */}
            <Card sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Organization
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>FAQ Group</InputLabel>
                  <Select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value as number | '')}
                    label="FAQ Group"
                  >
                    <MenuItem value="">
                      <em>No Group</em>
                    </MenuItem>
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Organize FAQs into groups</FormHelperText>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="Sort Order"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  helperText="Lower numbers appear first"
                  slotProps={{ htmlInput: { min: 0, max: 65535 } }}
                />
              </Stack>
            </Card>

            {/* Entity Association */}
            <Card sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Entity Association
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth size="small" error={!!fieldErrors.entity}>
                  <InputLabel>Entity Type</InputLabel>
                  <Select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value as EntityType | '')}
                    label="Entity Type"
                  >
                    <MenuItem value="">
                      <em>General FAQ</em>
                    </MenuItem>
                    {ENTITY_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {fieldErrors.entity || 'Link this FAQ to a specific entity'}
                  </FormHelperText>
                </FormControl>

                {entityType && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Entity ID"
                    type="number"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    error={!!fieldErrors.entity}
                    helperText="ID of the associated entity"
                    slotProps={{ htmlInput: { min: 1 } }}
                  />
                )}

                <TextField
                  fullWidth
                  size="small"
                  label="Claim ID (Optional)"
                  type="number"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  helperText="Link to a specific claim if applicable"
                  slotProps={{ htmlInput: { min: 1 } }}
                />
              </Stack>
            </Card>

            {/* Publishing Options */}
            <Card sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Publishing
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                    />
                  }
                  label="Published"
                />
                <FormHelperText>
                  {isPublished
                    ? 'This FAQ is visible to customers'
                    : 'This FAQ is saved as a draft'}
                </FormHelperText>

                <Divider />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isIndexable}
                      onChange={(e) => setIsIndexable(e.target.checked)}
                    />
                  }
                  label="Search Indexable"
                />
                <FormHelperText>
                  Allow search engines to index this FAQ
                </FormHelperText>
              </Stack>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}
