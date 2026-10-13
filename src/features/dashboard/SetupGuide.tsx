import { Box, Button, Card, CardContent, Collapse, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { shopKeys } from '../../shop/shopContext'
import { useShop } from '../../shop/useShop'

interface Task {
  key: string
  title: string
  status: 'pending' | 'done' | 'skipped' | 'failed'
}

/** Where each onboarding task is done, and what the button says. */
const TASK_ACTIONS: Record<string, { to: string; label: string; hint: string }> = {
  add_product: { to: '/products/new', label: 'Add product', hint: 'Write a description, add photos and set a price.' },
  customize_theme: { to: '/merchandising/themes', label: 'Customize theme', hint: 'Add your logo, choose colours and fonts, and arrange the sections of your home page.' },
  set_up_payments: { to: '/settings/integrations', label: 'Set up payments', hint: 'Connect a payment provider to take cards, UPI and wallets.' },
  set_up_shipping: { to: '/settings/shipping', label: 'Review shipping', hint: 'Check your delivery rates and where you ship.' },
  connect_messaging: { to: '/settings/integrations', label: 'Connect', hint: 'Send order confirmations and shipping updates from your own account.' },
  add_domain: { to: '/settings/domains', label: 'Add domain', hint: 'Use your own address, like www.yourbrand.com.' },
  launch_store: { to: '/settings/store', label: 'Remove password', hint: 'Open the storefront to everyone when you are ready.' },
}

/**
 * Shopify's setup guide: the handful of things a new store needs before its
 * first sale, each one click from where it is done. Hidden once everything is
 * done or skipped.
 */
export function SetupGuide() {
  const { summary } = useShop()
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search] = useSearchParams()
  // Arriving from signup: the store exists; say so before the to-do list.
  const welcome = search.get('welcome') === '1'

  const mark = useMutation({
    mutationFn: ({ key, status }: { key: string; status: 'done' | 'skipped' | 'pending' }) => api.post(`/shop/setup/${key}`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: shopKeys.current }),
  })

  const tasks = ((summary?.setup as { onboarding?: Task[] } | undefined)?.onboarding ?? []) as Task[]
  const remaining = tasks.filter((task) => task.status === 'pending' || task.status === 'failed')
  if (!open || tasks.length === 0 || remaining.length === 0) return null

  const done = tasks.length - remaining.length
  const current = expanded ?? remaining[0]?.key ?? null
  const canManage = can('shop.manage')

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6">{welcome ? `Welcome — ${summary?.shop.name ?? 'your store'} is ready` : 'Setup guide'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {welcome
                ? 'Your store already has a theme, categories, taxes and delivery rates. These steps get it ready for its first sale.'
                : `Use this guide to get ${summary?.shop.name ?? 'your store'} ready for its first sale.`}
            </Typography>
          </Box>
          <Tooltip title="Hide for now">
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1.5, mb: 1 }}>
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
            {done} of {tasks.length} tasks complete
          </Typography>
          <LinearProgress variant="determinate" value={(done / tasks.length) * 100} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
        </Stack>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {tasks.map((task) => {
            const action = TASK_ACTIONS[task.key]
            const isDone = task.status === 'done' || task.status === 'skipped'
            const isOpen = current === task.key && !isDone
            return (
              <Box key={task.key} sx={{ py: 1 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? '' : task.key)}>
                  <Tooltip title={isDone ? 'Mark as not done' : 'Mark as done'}>
                    <IconButton
                      size="small"
                      disabled={!canManage || mark.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        mark.mutate({ key: task.key, status: isDone ? 'pending' : 'done' })
                      }}
                    >
                      {isDone ? <CheckCircleIcon fontSize="small" color="success" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: isOpen ? 600 : 400, textDecoration: task.status === 'skipped' ? 'line-through' : undefined, color: isDone ? 'text.secondary' : undefined }}>
                    {task.title}
                  </Typography>
                  {!isDone && (isOpen ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />)}
                </Stack>
                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ pl: 5.5, pt: 0.5 }}>
                    {action && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {action.hint}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      {action && (
                        <Button size="small" variant="contained" onClick={() => navigate(action.to)}>
                          {action.label}
                        </Button>
                      )}
                      {canManage && (
                        <Button size="small" color="inherit" onClick={() => mark.mutate({ key: task.key, status: 'skipped' })}>
                          Skip
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}
