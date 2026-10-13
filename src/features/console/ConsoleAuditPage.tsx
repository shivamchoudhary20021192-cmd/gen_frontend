import { FormControlLabel, Switch } from '@mui/material'
import { useState } from 'react'
import { platformApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { AuditLogView, type AuditPage, type AuditQuery } from '../audit/AuditLogView'

/**
 * The platform's audit trail, across every store: what operators did
 * (plan edits, freezes, rate changes) and what happened in each store.
 */
export function ConsoleAuditPage() {
  const [platformOnly, setPlatformOnly] = useState(false)
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every store, newest first."
        actions={<FormControlLabel control={<Switch checked={platformOnly} onChange={(event) => setPlatformOnly(event.target.checked)} />} label="Platform actions only" />}
      />
      <AuditLogView
        queryKey={['console', 'audit']}
        showShop
        extraFilters={{ platform_only: platformOnly ? 'true' : undefined }}
        fetchPage={(query: AuditQuery) => platformApi.get<AuditPage>('/audit', query)}
      />
    </>
  )
}
