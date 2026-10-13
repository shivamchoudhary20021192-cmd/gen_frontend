import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ContentCopy as DuplicateIcon,
  DeleteOutlined as DeleteIcon,
  ErrorOutlined as BlockedIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material'
import { PageHeader } from '../../components/PageHeader'
import { tokens } from '../../theme'
import {
  CHANNEL_LABEL,
  useDeleteTemplate,
  useDuplicateTemplate,
  useMessagingCatalogue,
  useTemplates,
  type Template,
} from './useMessaging'

/**
 * Every message the shop can send, in one table.
 *
 * Two columns earn their place and would not be obvious from the outside.
 *
 * **Status** is not "active / inactive". A template can be switched on and still
 * be unsendable — no DLT registration, no Meta approval, no unsubscribe line —
 * and the difference between "off" and "on but refused" is the difference
 * between a decision and a bug. So the column shows what will actually happen.
 *
 * **Last 30 days** puts usage next to failures. A template nobody uses is a
 * template to delete; a template that fails twice as often as its neighbours is
 * a template whose wording or sender is wrong, and neither shows up anywhere
 * else in the admin.
 */

const CATEGORY_TONE: Record<string, { bg: string; fg: string }> = {
  marketing: { bg: tokens.infoSurface, fg: tokens.info },
  utility: { bg: tokens.sand, fg: tokens.ink },
  transactional: { bg: tokens.sand, fg: tokens.ink },
  authentication: { bg: tokens.warningSurface, fg: tokens.warning },
}

function StatusCell({ template }: { template: Template }) {
  const blockers = template.violations.filter((violation) => violation.severity === 'blocker')
  const warnings = template.violations.filter((violation) => violation.severity === 'warning')

  if (!template.is_active) {
    return <Chip size="small" label="Off" sx={{ bgcolor: tokens.sand, color: tokens.subdued }} />
  }
  if (blockers.length > 0) {
    return (
      <Tooltip title={blockers.map((violation) => violation.message).join(' ')}>
        <Chip
          size="small"
          icon={<BlockedIcon sx={{ fontSize: 15 }} />}
          label="Cannot send"
          sx={{ bgcolor: tokens.criticalSurface, color: tokens.critical, '& .MuiChip-icon': { color: tokens.critical } }}
        />
      </Tooltip>
    )
  }
  if (warnings.length > 0) {
    return (
      <Tooltip title={warnings.map((violation) => violation.message).join(' ')}>
        <Chip
          size="small"
          icon={<WarningIcon sx={{ fontSize: 15 }} />}
          label="Ready, with notes"
          sx={{ bgcolor: tokens.warningSurface, color: tokens.warning, '& .MuiChip-icon': { color: tokens.warning } }}
        />
      </Tooltip>
    )
  }
  return <Chip size="small" label="Ready" sx={{ bgcolor: tokens.successSurface, color: tokens.success }} />
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const [channel, setChannel] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<{ anchor: HTMLElement; template: Template } | null>(null)
  const [confirming, setConfirming] = useState<Template | null>(null)

  const catalogue = useMessagingCatalogue()
  const templates = useTemplates({
    channel: channel === 'all' ? undefined : channel,
    search: search.trim() || undefined,
  })
  const duplicate = useDuplicateTemplate()
  const remove = useDeleteTemplate()

  const rows = templates.data?.templates ?? []
  const counts = useMemo(() => {
    const blocked = rows.filter(
      (template) => template.is_active && template.violations.some((violation) => violation.severity === 'blocker'),
    ).length
    return { total: rows.length, blocked }
  }, [rows])

  return (
    <Box>
      <PageHeader
        title="Message templates"
        subtitle={
          counts.blocked > 0
            ? `${counts.total} templates · ${counts.blocked} cannot send yet`
            : `${counts.total} templates`
        }
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/notifications/templates/new')}
          >
            New template
          </Button>
        }
      />

      {/* The rules the shop is working under, said once at the top rather than
          discovered one refusal at a time. */}
      {catalogue.data && (
        <Typography sx={{ fontSize: 12.5, color: tokens.subdued, mb: 2 }}>
          Promotional messages send between {catalogue.data.rules.promotional_window}{' '}
          {catalogue.data.rules.timezone.split('/').pop()} time, at most once every{' '}
          {catalogue.data.rules.frequency_cap_hours} hours per person
          {catalogue.data.rules.dlt_enforced ? ', and every commercial SMS needs a registered DLT template ID' : ''}.
        </Typography>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={channel}
          onChange={(_event, value) => value && setChannel(value)}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="whatsapp">WhatsApp</ToggleButton>
          <ToggleButton value="sms">SMS</ToggleButton>
          <ToggleButton value="email">Email</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Search by name, event or wording"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.faint }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      <Card variant="outlined">
        {templates.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: tokens.subdued }}>
              No templates yet. The first one is usually the order confirmation.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Template</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Last 30 days</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((template) => (
                <TableRow
                  key={template.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/notifications/templates/${template.id}`)}
                >
                  <TableCell>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.inkStrong }}>
                      {template.name}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.faint }}>{template.event_key}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13 }}>{CHANNEL_LABEL[template.channel]}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={template.category}
                      sx={{
                        textTransform: 'capitalize',
                        bgcolor: CATEGORY_TONE[template.category]?.bg ?? tokens.sand,
                        color: CATEGORY_TONE[template.category]?.fg ?? tokens.ink,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusCell template={template} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: 13 }}>
                      {template.stats.sent_30d.toLocaleString('en-IN')} sent
                    </Typography>
                    {template.stats.failed_30d > 0 && (
                      <Typography sx={{ fontSize: 12, color: tokens.critical }}>
                        {template.stats.failed_30d} failed
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation()
                        setMenu({ anchor: event.currentTarget, template })
                      }}
                    >
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={async () => {
            if (!menu) return
            const copy = await duplicate.mutateAsync(menu.template.id)
            setMenu(null)
            navigate(`/notifications/templates/${copy.id}`)
          }}
        >
          <DuplicateIcon sx={{ fontSize: 17, mr: 1 }} /> Duplicate
        </MenuItem>
        <MenuItem
          sx={{ color: tokens.critical }}
          onClick={() => {
            setConfirming(menu?.template ?? null)
            setMenu(null)
          }}
        >
          <DeleteIcon sx={{ fontSize: 17, mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(confirming)} onClose={() => setConfirming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete “{confirming?.name}”?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: tokens.subdued }}>
            Messages already sent from it stay in the delivery log with their wording intact. Anything still pointing
            at it — an event, a campaign — will stop sending.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)}>Keep it</Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={async () => {
              if (!confirming) return
              await remove.mutateAsync(confirming.id)
              setConfirming(null)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
