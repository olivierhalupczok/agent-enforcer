import { useState } from 'react'
import { Link } from 'react-router'
import { useBanLink, useIncidents, useUnbanLink } from '../../api/playground'
import { badgeClass, buttonPrimary, buttonSecondary } from '../../ui/classes'
import { EmptyState, LoadingRows, PageHeader, PageShell } from '../../ui/Page'

const card = 'flex flex-col gap-3 rounded-xl border border-line bg-surface p-5'

const EVENT_LABELS: Record<string, string> = {
  command_blocked: 'Command blocked',
  file_blocked: 'File access blocked',
  link_blocked: 'Link fetch blocked',
  injection_detected: 'Prompt injection detected',
  source_auto_banned: 'Source auto-banned',
  approval_denied: 'Approval denied',
  output_redacted: 'Command output redacted',
  file_redacted: 'File content redacted',
  budget_exceeded: 'Budget exceeded',
  time_limit_exceeded: 'Time limit exceeded',
}

const MODE_BADGES: Record<string, { label: string; className: string }> = {
  block: { label: 'Blocked', className: 'bg-[#FBE7E2] text-danger' },
  warn: { label: 'Warned', className: 'bg-warn-bg text-warn-fg' },
  redacted: { label: 'Redacted', className: 'bg-warn-bg text-warn-fg' },
}

export function IncidentsPage() {
  const query = useIncidents()
  const ban = useBanLink()
  const unban = useUnbanLink()
  const [actionError, setActionError] = useState<string | null>(null)

  const act = (kind: 'ban' | 'unban', url: string) => {
    setActionError(null)
    const mutation = kind === 'ban' ? ban : unban
    mutation.mutate(url, {
      onError: (error) => setActionError((error as { message?: string }).message ?? `Couldn't ${kind} this link.`),
    })
  }

  const busy = ban.isPending || unban.isPending

  return (
    <PageShell>
      <PageHeader
        title="Incidents"
        actions={
          <button type="button" className={buttonSecondary} disabled={query.isFetching} onClick={() => void query.refetch()}>
            Refresh
          </button>
        }
      />

      {query.isError && (
        <div role="alert" className="rounded-lg border border-[#EFC4BC] bg-[#FBEAE6] p-3 text-sm text-danger">
          Couldn't load incidents. Check that the API is running.
          <button type="button" className={`${buttonSecondary} ml-3`} onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-lg border border-[#EFC4BC] bg-[#FBEAE6] p-3 text-sm text-danger">
          {actionError}
        </div>
      )}

      {query.isPending ? (
        <LoadingRows label="Loading incidents" count={3} />
      ) : !query.data ? null : query.data.length === 0 ? (
        <EmptyState
          title="No incidents recorded"
          description={
            <>
              Run a{' '}
              <Link to="/playground" className="font-medium">
                scenario on the Playground
              </Link>{' '}
              to generate a policy event for this prototype feed.
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {query.data.map((incident, i) => (
            <IncidentRow
              key={`${incident.ts}-${i}`}
              incident={incident}
              busy={busy}
              onBan={incident.url ? () => act('ban', incident.url!) : undefined}
              onUnban={incident.url ? () => act('unban', incident.url!) : undefined}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}

function IncidentRow({
  incident,
  busy,
  onBan,
  onUnban,
}: {
  incident: import('../../api/playground').Incident
  busy: boolean
  onBan?: () => void
  onUnban?: () => void
}) {
  const mode = MODE_BADGES[incident.mode] ?? MODE_BADGES.block
  const configLabel = incident.scope === 'defaults' ? 'Global config' : `Host: ${incident.scope}`
  return (
    <article aria-label={`Incident at ${incident.ts}`} className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${badgeClass} ${mode.className}`}>{mode.label}</span>
        <span className="text-sm font-semibold">{EVENT_LABELS[incident.event] ?? incident.event}</span>
        {incident.autoBanned && incident.event !== 'source_auto_banned' && (
          <span className={`${badgeClass} bg-[#FBE7E2] text-danger`}>Auto-banned</span>
        )}
        <span className={`${badgeClass} bg-[#E6E9F5] text-[#2E3A6B]`}>{configLabel}</span>
        {incident.tool && (
          <span className={`${badgeClass} bg-[#F0F0EB] text-[#30343B]`}>{incident.tool}</span>
        )}
        <span className="ml-auto font-mono text-xs text-muted">{incident.agent}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-mono">{incident.ts.replace('T', ' ').slice(0, 19)}Z</span>
      </div>
      {incident.hits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {incident.hits.map((h) => (
            <code key={h} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">
              {h}
            </code>
          ))}
        </div>
      )}
      {incident.url && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 truncate rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">
            {incident.url}
          </code>
          {incident.autoBanned ? (
            <button type="button" className={buttonSecondary} disabled={busy} onClick={onUnban}>
              Unban link
            </button>
          ) : (
            <button type="button" className={buttonPrimary} disabled={busy} onClick={onBan}>
              Ban link
            </button>
          )}
        </div>
      )}
      {incident.detail && (
        <pre className="m-0 max-h-40 overflow-auto rounded bg-canvas p-2 font-mono text-[12px] whitespace-pre-wrap">
          {incident.detail}
        </pre>
      )}
    </article>
  )
}
