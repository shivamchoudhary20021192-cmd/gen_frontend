import { Box, Card, CardContent, Chip, Grid, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { platformApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { countryName, formatDate, formatMoneyIn } from '../../lib/format'
import { consoleKeys, STATUS_CHIP, type ConsoleOverview, type ShopStatus } from './consoleTypes'

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption">{label}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

/** Every one of the last 30 days (UTC), with the days nobody signed up as zeros, so the chart reads as a timeline. */
function lastThirtyDays(rows: { day: string; total: number }[]): { day: string; total: number }[] {
  const byDay = new Map(rows.map((row) => [row.day, row.total]))
  const days: { day: string; total: number }[] = []
  const today = new Date()
  for (let offset = 29; offset >= 0; offset--) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset))
    const day = date.toISOString().slice(0, 10)
    days.push({ day, total: byDay.get(day) ?? 0 })
  }
  return days
}

/** The platform at a glance: how many stores, paying what, growing how fast, and whether the machinery is healthy. */
export function ConsoleOverviewPage() {
  const navigate = useNavigate()
  const overview = useQuery({ queryKey: consoleKeys.overview, queryFn: () => platformApi.get<ConsoleOverview>('/overview'), refetchInterval: 60_000 })
  const data = overview.data

  const byStatus = data?.shops_by_status ?? {}
  const live = (byStatus.active ?? 0) + (byStatus.paused ?? 0) + (byStatus.frozen ?? 0)
  const paying = (data?.revenue ?? []).reduce((sum, row) => sum + row.paying, 0)
  const trialing = (data?.revenue ?? []).reduce((sum, row) => sum + row.trialing, 0)
  const signups = useMemo(() => lastThirtyDays(data?.signups_last_30_days ?? []), [data])
  const signupTotal = signups.reduce((sum, row) => sum + row.total, 0)
  const dead = (data?.jobs ?? []).filter((row) => row.status === 'dead').reduce((sum, row) => sum + row.count, 0)
  const pending = (data?.jobs ?? []).filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.count, 0)

  return (
    <>
      <PageHeader title="Platform overview" subtitle="Refreshes every minute." />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Metric label="Live stores" value={String(live)} hint={`${byStatus.provisioning ?? 0} provisioning · ${byStatus.closed ?? 0} closed`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Metric label="Paying stores" value={String(paying)} hint={`${trialing} on a free trial`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Metric
            label="Monthly recurring revenue"
            value={(data?.revenue ?? []).filter((row) => row.mrr > 0).map((row) => formatMoneyIn(row.mrr, row.currency)).join(' + ') || formatMoneyIn(0, 'INR')}
            hint="Paying subscriptions; yearly plans counted monthly"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Metric
            label="Outstanding bills"
            value={(data?.outstanding ?? []).map((row) => formatMoneyIn(row.total, row.currency)).join(' + ') || '—'}
            hint={`${(data?.outstanding ?? []).reduce((sum, row) => sum + row.bills, 0)} unpaid`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title="New stores" description={`${signupTotal} in the last 30 days.`}>
            <Box sx={{ height: 200, width: '100%' }}>
              {signupTotal === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No new stores in the last 30 days.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={signups} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [value, 'Stores']} labelFormatter={(day) => formatDate(String(day))} />
                    <Bar dataKey="total" fill="#303030" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </SectionCard>

          <SectionCard title="Newest stores" flush>
            <Table size="small">
              <TableBody>
                {(data?.newest_shops ?? []).map((shop) => (
                  <TableRow key={shop.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/console/stores/${shop.id}`)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {shop.name}
                      </Typography>
                      <Typography variant="caption">{shop.handle}</Typography>
                    </TableCell>
                    <TableCell>{countryName(shop.country_code)}</TableCell>
                    <TableCell>{shop.plan ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_CHIP[shop.status].label} color={STATUS_CHIP[shop.status].color} />
                    </TableCell>
                    <TableCell align="right">{formatDate(shop.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Stores by status">
            <Stack spacing={1}>
              {(Object.keys(STATUS_CHIP) as ShopStatus[]).map((status) => (
                <Stack key={status} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/console/stores?status=${status}`)}>
                  <Chip size="small" label={STATUS_CHIP[status].label} color={STATUS_CHIP[status].color} />
                  <Typography variant="body2">{byStatus[status] ?? 0}</Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard title="Stores by plan">
            <Stack spacing={1}>
              {Object.entries(data?.shops_by_plan ?? {}).map(([plan, total]) => (
                <Stack key={plan} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2">{plan}</Typography>
                  <Typography variant="body2">{total}</Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard title="Background jobs" description={dead > 0 ? `${dead} failed for good and need a look.` : 'Nothing has failed for good.'}>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`${pending} waiting`} />
              <Chip size="small" label={`${dead} dead`} color={dead > 0 ? 'error' : 'default'} onClick={() => navigate('/console/jobs')} />
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </>
  )
}
