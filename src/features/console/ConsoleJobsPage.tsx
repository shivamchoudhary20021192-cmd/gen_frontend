import { Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { platformApi } from '../../api/client'
import { FlashSnackbar } from '../../components/FlashSnackbar'
import { PageHeader } from '../../components/PageHeader'
import { SectionCard } from '../../components/SectionCard'
import { useFlash } from '../../hooks/useFlash'
import { errorMessage } from '../../lib/errors'
import { formatRelative } from '../../lib/format'
import { consoleKeys, type JobStat } from './consoleTypes'
import { useOperator } from './useOperator'

interface DeadJob {
  id: number
  queue: string
  type: string
  shop_id: number | null
  attempts: number
  last_error: string | null
  finished_at: string | null
}

/**
 * The background queue: webhooks out, integrations, messaging, billing,
 * provisioning. A job that exhausts its retries is "dead" and waits here for
 * a person — usually after the cause (a bad credential, a provider outage)
 * has been fixed, a retry is all it needs.
 */
export function ConsoleJobsPage() {
  const queryClient = useQueryClient()
  const { canAct } = useOperator()
  const { flash, success, error: flashError, clear } = useFlash()
  const jobs = useQuery({ queryKey: consoleKeys.jobs, queryFn: () => platformApi.get<{ stats: JobStat[]; dead: DeadJob[] }>('/jobs'), refetchInterval: 15_000 })

  const retry = useMutation({
    mutationFn: (job: DeadJob) => platformApi.post(`/jobs/${job.id}/retry`),
    onSuccess: (_result, job) => {
      success(`${job.type} #${job.id} queued again`)
      void queryClient.invalidateQueries({ queryKey: consoleKeys.jobs })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const stats = jobs.data?.stats ?? []
  const queues = [...new Set(stats.map((row) => row.queue))].sort()
  const count = (queue: string, status: JobStat['status']) => stats.find((row) => row.queue === queue && row.status === status)?.count ?? 0

  return (
    <>
      <PageHeader title="Background jobs" subtitle="Refreshes every 15 seconds." />
      <SectionCard title="Queues" flush>
        {queues.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            Every queue is empty.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Queue</TableCell>
                <TableCell align="right">Waiting</TableCell>
                <TableCell align="right">Running</TableCell>
                <TableCell align="right">Dead</TableCell>
                <TableCell>Oldest waiting</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue}>
                  <TableCell sx={{ fontWeight: 600 }}>{queue}</TableCell>
                  <TableCell align="right">{count(queue, 'pending')}</TableCell>
                  <TableCell align="right">{count(queue, 'running')}</TableCell>
                  <TableCell align="right">{count(queue, 'dead') > 0 ? <Chip size="small" color="error" label={count(queue, 'dead')} /> : 0}</TableCell>
                  <TableCell>{formatRelative(stats.find((row) => row.queue === queue && row.status === 'pending')?.oldest ?? null)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Dead jobs" description="The last 100 that ran out of retries." flush>
        {(jobs.data?.dead.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            None. Everything that failed was retried successfully.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Store</TableCell>
                <TableCell>Last error</TableCell>
                <TableCell>Gave up</TableCell>
                {canAct && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.data!.dead.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Typography variant="body2">{job.type}</Typography>
                    <Typography variant="caption">
                      #{job.id} · {job.queue} · {job.attempts} attempts
                    </Typography>
                  </TableCell>
                  <TableCell>{job.shop_id ?? '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 380 }}>
                    <Tooltip title={job.last_error ?? ''}>
                      <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                        {job.last_error ?? '—'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{formatRelative(job.finished_at)}</TableCell>
                  {canAct && (
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" disabled={retry.isPending} onClick={() => retry.mutate(job)}>
                          Retry
                        </Button>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
