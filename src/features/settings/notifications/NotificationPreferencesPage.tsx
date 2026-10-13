import { Autocomplete, Box, Button, Chip, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'

type Channel = 'email' | 'sms' | 'whatsapp'

interface Notification {
  key: string
  audience: 'customer' | 'staff'
  group: string
  label: string
  description: string
  channels: { channel: Channel; enabled: boolean; recipients?: string[] }[]
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

const prefsKey = ['notification-preferences'] as const

/**
 * Settings → Notifications: which automatic messages go out, and on which
 * channels. The wording of each lives in Messaging → Templates; the service
 * that sends them lives in Integrations.
 */
export function NotificationPreferencesPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('notifications.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const prefs = useQuery({ queryKey: prefsKey, queryFn: () => api.get<{ notifications: Notification[] }>('/notifications/preferences') })

  const set = useMutation({
    mutationFn: (input: { key: string; channel: Channel; enabled: boolean; recipients?: string[] }) => api.put('/notifications/preferences', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: prefsKey })
      const previous = queryClient.getQueryData<{ notifications: Notification[] }>(prefsKey)
      if (previous) {
        queryClient.setQueryData(prefsKey, {
          notifications: previous.notifications.map((entry) =>
            entry.key !== input.key
              ? entry
              : { ...entry, channels: entry.channels.map((channel) => (channel.channel === input.channel ? { ...channel, enabled: input.enabled, recipients: input.recipients ?? channel.recipients } : channel)) },
          ),
        })
      }
      return { previous }
    },
    onError: (caught, _input, context) => {
      if (context?.previous) queryClient.setQueryData(prefsKey, context.previous)
      flashError(errorMessage(caught))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: prefsKey }),
  })

  const list = prefs.data?.notifications ?? []
  const customer = list.filter((entry) => entry.audience === 'customer')
  const staff = list.filter((entry) => entry.audience === 'staff')
  const groups = [...new Set(customer.map((entry) => entry.group))]

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Automatic messages to customers and to your team."
        actions={
          <Button component={RouterLink} to="/notifications/templates" variant="outlined">
            Edit message wording
          </Button>
        }
      />

      {groups.map((group) => (
        <SectionCard key={group} title={`Customer notifications · ${group}`} flush>
          <PreferenceTable entries={customer.filter((entry) => entry.group === group)} disabled={!canManage} onToggle={(key, channel, enabled) => set.mutate({ key, channel, enabled })} />
        </SectionCard>
      ))}

      {staff.length > 0 && (
        <SectionCard title="Staff notifications" description="Alerts for your team. Add the addresses that should receive each one." flush>
          <Table size="small">
            <TableBody>
              {staff.map((entry) => (
                <StaffRow
                  key={entry.key}
                  entry={entry}
                  disabled={!canManage}
                  onSave={(channel, enabled, recipients) =>
                    set.mutate({ key: entry.key, channel, enabled, recipients }, { onSuccess: () => success(`${entry.label} saved`) })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}

function PreferenceTable({ entries, disabled, onToggle }: { entries: Notification[]; disabled: boolean; onToggle(key: string, channel: Channel, enabled: boolean): void }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Notification</TableCell>
          {CHANNELS.map((channel) => (
            <TableCell key={channel.key} align="center" sx={{ width: 96 }}>
              {channel.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.key} hover>
            <TableCell>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {entry.label}
              </Typography>
              <Typography variant="caption">{entry.description}</Typography>
            </TableCell>
            {CHANNELS.map((channel) => {
              const state = entry.channels.find((item) => item.channel === channel.key)
              return (
                <TableCell key={channel.key} align="center">
                  {state ? (
                    <Switch size="small" checked={state.enabled} disabled={disabled} onChange={(event) => onToggle(entry.key, channel.key, event.target.checked)} slotProps={{ input: { 'aria-label': `${entry.label} by ${channel.label}` } }} />
                  ) : (
                    <Typography variant="caption">—</Typography>
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StaffRow({ entry, disabled, onSave }: { entry: Notification; disabled: boolean; onSave(channel: Channel, enabled: boolean, recipients: string[]): void }) {
  const email = entry.channels.find((channel) => channel.channel === 'email') ?? entry.channels[0]
  const [recipients, setRecipients] = useState<string[]>(email?.recipients ?? [])
  const dirty = JSON.stringify(recipients) !== JSON.stringify(email?.recipients ?? [])
  if (!email) return null
  return (
    <TableRow>
      <TableCell sx={{ width: '40%' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {entry.label}
        </Typography>
        <Typography variant="caption">{entry.description}</Typography>
      </TableCell>
      <TableCell>
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={recipients}
          onChange={(_event, value) => setRecipients(value.map((item) => item.trim().toLowerCase()).filter((item) => /.+@.+\..+/.test(item)))}
          disabled={disabled}
          renderValue={(value, getItemProps) =>
            value.map((option, index) => {
              const { key, ...itemProps } = getItemProps({ index })
              return <Chip key={key} size="small" label={option} {...itemProps} />
            })
          }
          renderInput={(params) => <TextField {...params} size="small" placeholder={recipients.length ? '' : 'Type an email and press Enter'} />}
        />
      </TableCell>
      <TableCell sx={{ width: 170 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch size="small" checked={email.enabled} disabled={disabled} onChange={(event) => onSave(email.channel, event.target.checked, recipients)} />
          {dirty && (
            <Button size="small" disabled={disabled} onClick={() => onSave(email.channel, email.enabled, recipients)}>
              Save
            </Button>
          )}
        </Box>
      </TableCell>
    </TableRow>
  )
}
