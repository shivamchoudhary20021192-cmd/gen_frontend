import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { AuditLogView, type AuditPage, type AuditQuery } from '../../audit/AuditLogView'

/**
 * Settings → Audit log: everything done to this store — by its staff, its
 * apps, its customers' actions that change records, and the platform's
 * operators (a plan change, a freeze) — newest first.
 */
export function AuditLogPage() {
  const areas = useQuery({ queryKey: ['audit', 'areas'], queryFn: () => api.get<{ areas: { area: string; total: number }[] }>('/audit/actions') })
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what in your store, and when." />
      <AuditLogView queryKey={['audit', 'entries']} areas={areas.data?.areas} fetchPage={(query: AuditQuery) => api.get<AuditPage>('/audit', query)} />
    </>
  )
}
