import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { tokens } from '../../theme'
import { MessagePreview } from './MessagePreview'
import {
  CHANNEL_LABEL,
  useCustomerMessaging,
  useCustomerThread,
  useSendToCustomer,
  type Channel,
} from './useMessaging'

/**
 * Messaging one customer, from their own page.
 *
 * The dialog opens on what is *possible* rather than on an empty textarea,
 * because on two of the three channels free text is not possible at all: Indian
 * SMS has to map to a DLT-registered template, and WhatsApp only allows a
 * free-form reply within 24 hours of the customer's own last message. Showing a
 * box that will be refused on send is the unkindest version of this screen.
 *
 * So each channel arrives with its own state — address, opt-in, when they were
 * last messaged, whether free text is allowed and why not — and the composer
 * offers templates or a text box accordingly. The history underneath is the
 * same delivery log, filtered to this person: what we said, and when.
 */
export function SendMessageDialog({
  customerId,
  open,
  onClose,
}: {
  customerId: number
  open: boolean
  onClose: () => void
}) {
  const context = useCustomerMessaging(open ? customerId : null)
  const thread = useCustomerThread(open ? customerId : null)
  const send = useSendToCustomer(customerId)

  const [tab, setTab] = useState(0)
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [purpose, setPurpose] = useState<'service' | 'marketing'>('service')

  const channels = context.data?.channels ?? []
  const state = channels.find((row) => row.channel === channel) ?? null

  // Open on a channel that can actually be used, rather than on WhatsApp by
  // habit when the customer has no WhatsApp number.
  useEffect(() => {
    if (!context.data) return
    const usable = context.data.channels.find((row) => row.can_send)
    if (usable) setChannel(usable.channel)
  }, [context.data])

  useEffect(() => {
    setTemplateId('')
    setBody('')
    setSubject('')
  }, [channel])

  const canSend = Boolean(state?.can_send) && (templateId !== '' || (state?.free_text && body.trim() !== ''))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Message {context.data?.customer.name ?? 'this customer'}
      </DialogTitle>

      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ px: 3, minHeight: 40 }}>
        <Tab label="Send" sx={{ minHeight: 40 }} />
        <Tab label={`History${thread.data ? ` (${thread.data.messages.length})` : ''}`} sx={{ minHeight: 40 }} />
      </Tabs>
      <Divider />

      <DialogContent>
        {context.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : tab === 0 ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="dm-channel">Channel</InputLabel>
              <Select
                labelId="dm-channel"
                label="Channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
              >
                {channels.map((row) => (
                  <MenuItem key={row.channel} value={row.channel} disabled={!row.can_send}>
                    {CHANNEL_LABEL[row.channel]}
                    <Typography component="span" sx={{ fontSize: 11.5, color: tokens.faint, ml: 1 }}>
                      {row.can_send ? row.address : row.reasons[0]}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {state && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Chip
                  size="small"
                  label={state.opted_in_to_marketing ? 'Opted in to marketing' : 'No marketing opt-in'}
                  sx={{
                    bgcolor: state.opted_in_to_marketing ? tokens.successSurface : tokens.sand,
                    color: state.opted_in_to_marketing ? tokens.success : tokens.subdued,
                  }}
                />
                {state.last_messaged_at && (
                  <Chip
                    size="small"
                    label={`Last messaged ${new Date(state.last_messaged_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}`}
                    sx={{ bgcolor: tokens.sand, color: tokens.subdued }}
                  />
                )}
              </Stack>
            )}

            <FormControl size="small" fullWidth>
              <InputLabel id="dm-template">Template</InputLabel>
              <Select
                labelId="dm-template"
                label="Template"
                value={templateId}
                onChange={(event) => setTemplateId(Number(event.target.value) || '')}
              >
                <MenuItem value="">
                  <em>{state?.free_text ? 'Write it myself' : 'Choose a template'}</em>
                </MenuItem>
                {(state?.templates ?? []).map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {templateId === '' && (
              <>
                {!state?.free_text && (
                  <Alert severity="info">{state?.free_text_reason ?? 'Choose a template for this channel.'}</Alert>
                )}
                {state?.free_text && (
                  <>
                    {channel === 'email' && (
                      <TextField
                        label="Subject"
                        size="small"
                        fullWidth
                        placeholder="About your order"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                      />
                    )}
                    <TextField
                      label="Message"
                      size="small"
                      fullWidth
                      multiline
                      minRows={5}
                      placeholder="Hi {{first_name}}, …"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      helperText={`${body.length} of ${state.limits.body} characters`}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="dm-purpose">What this is</InputLabel>
                      <Select
                        labelId="dm-purpose"
                        label="What this is"
                        value={purpose}
                        onChange={(event) => setPurpose(event.target.value as 'service' | 'marketing')}
                      >
                        <MenuItem value="service">A reply about something they are doing</MenuItem>
                        <MenuItem value="marketing">Promotional</MenuItem>
                      </Select>
                    </FormControl>
                    {purpose === 'marketing' && !state.opted_in_to_marketing && (
                      <Alert severity="warning">
                        This customer has not opted in to marketing on {CHANNEL_LABEL[channel]}, so a promotional
                        message will be refused.
                      </Alert>
                    )}
                    {body.trim() !== '' && (
                      <MessagePreview channel={channel} subject={subject} body={body} from={state.address} />
                    )}
                  </>
                )}
              </>
            )}

            {send.isError && <Alert severity="error">{(send.error as Error).message}</Alert>}
            {send.isSuccess && (
              <Alert severity="success">
                Sent. It is in the delivery log{send.data.delivered ? ' and has been delivered' : ''}.
              </Alert>
            )}
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {(thread.data?.messages ?? []).length === 0 && (
              <Typography sx={{ fontSize: 13, color: tokens.subdued }}>
                Nothing has been sent to this customer yet.
              </Typography>
            )}
            {(thread.data?.messages ?? []).map((message) => (
              <Box key={message.id} sx={{ border: `1px solid ${tokens.border}`, borderRadius: 1.5, p: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                    {CHANNEL_LABEL[message.channel]} · {message.template_name ?? message.event_key}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.faint }}>
                    {new Date(message.queued_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Stack>
                {message.body && (
                  <Typography sx={{ fontSize: 12.5, color: tokens.subdued, whiteSpace: 'pre-wrap' }}>
                    {message.body.slice(0, 280)}
                    {message.body.length > 280 ? '…' : ''}
                  </Typography>
                )}
                <Typography
                  sx={{
                    fontSize: 11.5,
                    mt: 0.5,
                    color: message.status === 'failed' ? tokens.critical : tokens.faint,
                  }}
                >
                  {message.status}
                  {message.simulated ? ' · simulated' : ''}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {tab === 0 && (
          <Button
            variant="contained"
            disabled={!canSend || send.isPending}
            onClick={() =>
              send.mutate({
                channel,
                template_id: templateId === '' ? null : templateId,
                subject: subject || null,
                body: body || null,
                purpose,
              })
            }
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
