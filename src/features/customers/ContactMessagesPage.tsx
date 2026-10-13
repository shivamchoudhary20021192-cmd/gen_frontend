import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutlined'
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined'
import SearchIcon from '@mui/icons-material/Search'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatRelative } from '../../lib/format'

/**
 * Customers → Messages: what shoppers sent through the store's contact form.
 * An inbox, not a help desk — reply by email from the address they left;
 * mark it read, archive it when it is dealt with.
 */

interface Message {
  id: number
  name: string | null
  email: string
  phone: string | null
  body: string
  fields: Record<string, unknown>
  page_path: string | null
  status: 'new' | 'read' | 'archived'
  created_at: string
}

interface MessageList {
  messages: Message[]
  counts: { new: number; read: number; archived: number }
  pagination: { page: number; pages: number; total: number }
}

type View = 'inbox' | 'new' | 'archived'

export function ContactMessagesPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canUpdate = can('customers.update')
  const [view, setView] = useState<View>('inbox')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)
  const term = useDebounce(search, 300)

  const list = useQuery({
    queryKey: ['contact-messages', view, term, page],
    queryFn: () => api.get<MessageList>('/contact-messages', { status: view, q: term || undefined, page, limit: 25 }),
    placeholderData: keepPreviousData,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Message['status'] }) => api.patch<{ message: Message }>(`/contact-messages/${id}`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['contact-messages'] }),
  })

  const messages = list.data?.messages ?? []
  const open = messages.find((message) => message.id === openId) ?? null

  const choose = (message: Message) => {
    setOpenId(message.id)
    if (message.status === 'new' && canUpdate) setStatus.mutate({ id: message.id, status: 'read' })
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="What shoppers send through your store’s contact form." />
      {list.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}
      <Card sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '380px 1fr' }, minHeight: 520 }}>
        <Box sx={{ borderRight: { md: 1 }, borderColor: 'divider', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Tabs value={view} onChange={(_event, next: View) => { setView(next); setPage(1); setOpenId(null) }} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab value="inbox" label="Inbox" />
            <Tab value="new" label={`Unread${list.data?.counts.new ? ` (${list.data.counts.new})` : ''}`} />
            <Tab value="archived" label="Archived" />
          </Tabs>
          <Box sx={{ p: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search name, email or message"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
          </Box>
          <Divider />
          {messages.length === 0 && !list.isLoading ? (
            <Stack spacing={1} sx={{ p: 4, alignItems: 'center', color: 'text.secondary', textAlign: 'center' }}>
              <MailOutlineIcon />
              <Typography variant="body2">
                {term ? `Nothing matches “${term}”.` : view === 'archived' ? 'No archived messages.' : 'No messages yet. They arrive here when shoppers use the contact form on your store.'}
              </Typography>
            </Stack>
          ) : (
            <List disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
              {messages.map((message) => (
                <ListItemButton key={message.id} selected={message.id === openId} onClick={() => choose(message)} sx={{ alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      {message.status === 'new' && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
                      <Typography variant="body2" noWrap sx={{ fontWeight: message.status === 'new' ? 700 : 500, flex: 1 }}>
                        {message.name || message.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {formatRelative(message.created_at)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {message.body}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          )}
          {(list.data?.pagination.pages ?? 1) > 1 && (
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
              <Pagination size="small" count={list.data!.pagination.pages} page={page} onChange={(_event, next) => setPage(next)} />
            </Box>
          )}
        </Box>

        <Box sx={{ p: 3, minWidth: 0 }}>
          {open ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6">{open.name || open.email}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {open.email}
                    {open.phone ? ` · ${open.phone}` : ''} · {formatDate(open.created_at)}
                  </Typography>
                </Box>
                <Chip size="small" label={open.status === 'new' ? 'Unread' : open.status === 'archived' ? 'Archived' : 'Read'} />
              </Stack>
              <Divider />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {open.body}
              </Typography>
              {Object.keys(open.fields).length > 0 && (
                <Box>
                  {Object.entries(open.fields).map(([key, value]) => (
                    <Typography key={key} variant="body2" color="text.secondary">
                      <strong>{key.replace(/_/g, ' ')}:</strong> {String(value)}
                    </Typography>
                  ))}
                </Box>
              )}
              {open.page_path && (
                <Typography variant="caption" color="text.secondary">
                  Sent from {open.page_path}
                </Typography>
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" href={`mailto:${open.email}?subject=${encodeURIComponent('Re: your message')}`}>
                  Reply by email
                </Button>
                {canUpdate && open.status !== 'archived' && (
                  <Button startIcon={<ArchiveOutlinedIcon />} onClick={() => { setStatus.mutate({ id: open.id, status: 'archived' }); setOpenId(null) }}>
                    Archive
                  </Button>
                )}
                {canUpdate && open.status === 'archived' && (
                  <Button startIcon={<UnarchiveOutlinedIcon />} onClick={() => setStatus.mutate({ id: open.id, status: 'read' })}>
                    Move to inbox
                  </Button>
                )}
                {canUpdate && open.status === 'read' && (
                  <Button startIcon={<MarkEmailUnreadOutlinedIcon />} onClick={() => setStatus.mutate({ id: open.id, status: 'new' })}>
                    Mark unread
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', textAlign: 'center' }}>
              <MailOutlineIcon fontSize="large" />
              <Typography variant="body2">Choose a message to read it.</Typography>
            </Stack>
          )}
        </Box>
      </Card>
    </>
  )
}
