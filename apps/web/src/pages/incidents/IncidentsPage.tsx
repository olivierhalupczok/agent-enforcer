import { useState } from 'react'
import { Link } from 'react-router'
import { useBanLink, useIncidents, useUnbanLink } from '../../api/playground'
import { badgeClass, buttonPrimary, buttonSecondary } from '../../ui/classes'

const card = 'flex flex-col gap-3 rounded-xl border border-line bg-surface p-5'

export function IncidentsPage() {
  const query = useIncidents()
  const ban = useBanLink()
  const unban = useUnbanLink()
  const [actionError, setActionError] = useState<string | null>(null)

  const act = (fn: (url: string) => void, url: string) => {
    setActionError(null)
    fn(url)
  }

  const banError = (ban.error ?? unban.error) as { message?: string } | null
  const currentError = banError?.message ?? null
  if (banError && actionError !== currentError) setActionError(currentError)

  const busy = ban.isPending || unban.isPending

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="mr-auto max-w-2xl">
          <h1 className="m-0 text-[28px] font-semibold tracking-tight">Incidents</h1>
          <p className="m-0 text-[13px] text-muted">
            Prompt-injection detections recorded by the control layer extension while agents worked.
            Sources get auto-banned; ban or unban links manually below.
          </p>
        </div>
        <button type="button" className={buttonSecondary} onClick={() => void query.refetch()}>
          Refresh
        </button>
      </header>

      {(actionError || query.isError) && (
        <div role="alert" className="rounded-lg border border-[#EFC4BC] bg-[#FBEAE6] p-3 text-sm text-danger">
          {actionError ?? "Couldn't load incidents — is the API running?"}
          {query.isError && (
            <button type="button" className={`${buttonSecondary} ml-3`} onClick={() => void query.refetch()}>
              Retry
            </button>
          )}
        </div>
      )}

      {!query.isSuccess ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : query.data.length === 0 ? (
        <div className={card}>
          <p className="m-0 text-sm text-muted">
            No incidents recorded yet. Run the{' '}
            <Link to="/playground" className="font-medium">
              injection scenario on the Playground
            </Link>{' '}
            — a detection lands here (and auto-bans its source) the moment the agent touches it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {query.data.map((incident, i) => (
            <IncidentRow
              key={`${incident.ts}-${i}`}
              incident={incident}
              busy={busy}
              onBan={() => act((u) => ban.mutate(u), incident.url!)}
              onUnban={() => act((u) => unban.mutate(u), incident.url!)}
            />
          ))}
        </div>
      )}
    </section>
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
  onBan: () => void
  onUnban: () => void
}) {
  const modeBadge =
    incident.mode === 'block' ? 'bg-[#FBE7E2] text-danger' : 'bg-warn-bg text-warn-fg'
  return (
    <article aria-label={`Incident at ${incident.ts}`} className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${badgeClass} ${modeBadge}`}>
          {incident.mode === 'block' ? 'Blocked' : 'Warned'}
        </span>
        {incident.autoBanned && (
          <span className={`${badgeClass} bg-[#FBE7E2] text-danger`}>Auto-banned</span>
        )}
        <span className="font-mono text-xs text-muted">{incident.agent}</span>
        <span className="text-xs text-muted">{new Date(incident.ts).toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {incident.hits.map((h) => (
          <code key={h} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">
            {h}
          </code>
        ))}
      </div>
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
        <pre className="m-0 overflow-auto rounded bg-canvas p-2 font-mono text-[12px] whitespace-pre-wrap">
          {incident.detail}
        </pre>
      )}
    </article>
  )
}
