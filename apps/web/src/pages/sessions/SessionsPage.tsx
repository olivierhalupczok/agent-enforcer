import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { useAgents } from '../../api/agents'
import { useLiveRefresh, useSessions } from '../../api/audit'
import type { AgentSession, SessionFilters } from '../../api/types'
import { buttonSecondary, inputClass, pillClass } from '../../ui/classes'
import { formatCost, formatDuration, formatRelative, formatTime, shortId } from '../../ui/format'
import { LiveBadge } from '../../ui/LiveBadge'
import { LoadError } from '../ApiUnavailable'

const HEADERS = ['Agent / session', 'Started', 'Activity', 'Token flow', 'Spend', 'State', 'Audit']
const cell = 'px-5 py-4 align-middle'
const labelClass = 'text-[13px] font-semibold text-[#30343B]'
const key = (s: AgentSession) => `${s.agent_id}/${s.context_id}`

export function SessionsPage() {
  const [filters, setFilters] = useState<SessionFilters>({})
  const [open, setOpen] = useState<string | null>(null)
  const sessions = useSessions(filters)
  const agents = useAgents()
  // audit_events too: a session's "N events" count changes when an event is recorded.
  const live = useLiveRefresh(['agent_sessions', 'audit_events'], [['sessions']])
  const list = sessions.data?.pages.flatMap((page) => page.data) ?? []
  const agentName = (s: AgentSession) => s.agent_name ?? agents.data?.find((a) => a.id === s.agent_id)?.name ?? s.agent_id
  const activeCount = list.filter((session) => session.status === 'active').length
  const stoppedCount = list.length - activeCount
  const eventCount = list.reduce((total, session) => total + session.events, 0)

  let content
  if (sessions.isError) {
    content = <LoadError what="sessions" error={sessions.error} onRetry={() => void sessions.refetch()} />
  } else if (sessions.isPending) {
    content = (
      <div role="status" className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Loading sessions">
        <span className="sr-only">Loading sessions…</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="grid min-h-20 grid-cols-[minmax(180px,1.7fr)_repeat(3,1fr)] items-center gap-6 border-b border-line px-5 last:border-b-0">
            <span className="h-3 w-36 rounded-full bg-line" />
            <span className="h-3 w-20 rounded-full bg-line" />
            <span className="h-3 w-24 rounded-full bg-line" />
            <span className="h-7 w-16 rounded-full bg-line" />
          </div>
        ))}
      </div>
    )
  } else if (list.length === 0) {
    content = (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="mb-5 h-12 w-12 text-teal" fill="none">
          <path d="M24 5.5 39 11v11.3c0 9.2-6.2 16.8-15 20.2-8.8-3.4-15-11-15-20.2V11l15-5.5Z" stroke="currentColor" strokeWidth="2" />
          <path d="M17 24.5h4.4l2.3-6 4.2 12 2.2-6H35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="m-0 text-lg font-semibold tracking-[-0.01em]">
          {filters.agent_id || filters.status ? 'No matching traffic' : 'Waiting for guarded traffic'}
        </h2>
        <p className="mt-2 mb-4 max-w-md text-sm leading-6 text-muted">
          {filters.agent_id || filters.status ? 'No sessions match these filters.' : "No sessions yet. Calls through an agent's guarded URL show up here."}
        </p>
        {filters.agent_id || filters.status ? (
          <button type="button" className={buttonSecondary} onClick={() => setFilters({})}>Clear filters</button>
        ) : (
          <Link to="/agents" className="text-sm font-semibold underline decoration-teal/30 underline-offset-4">Go to Agents</Link>
        )}
      </div>
    )
  } else {
    content = (
      <>
        <div role="region" aria-label="Sessions table" tabIndex={0} className="sessions-table overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm tabular-nums">
            <thead className="bg-[#F9F9F6]">
              <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
                {HEADERS.map((h) => <th key={h} scope="col" className="px-5 py-3.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const expanded = open === key(s)
                return (
                  <Fragment key={key(s)}>
                    <tr className="group border-b border-line transition-colors hover:bg-[#FAFAF7] last:border-b-0">
                      <td className={cell}>
                        <span className="flex min-w-48 flex-col gap-1">
                          <Link to={`/agents/${s.agent_id}`} className="w-fit font-semibold text-ink no-underline group-hover:text-teal-dark">
                            {agentName(s)}
                          </Link>
                          <code className="w-fit font-mono text-[11px] text-muted" title={s.context_id}>{shortId(s.context_id)}</code>
                        </span>
                      </td>
                      <td className={`${cell} whitespace-nowrap text-muted`} title={formatTime(s.started_at)}>{formatRelative(s.started_at)}</td>
                      <td className={cell}>
                        <span className="flex flex-col gap-1">
                          <span className="font-medium"><span>{s.turns}</span> {s.turns === 1 ? 'turn' : 'turns'}</span>
                          <span className="text-xs text-muted">{formatDuration(s.duration_seconds)}</span>
                        </span>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">{s.input_tokens} / {s.output_tokens}</span>
                          <span className="text-[11px] tracking-[0.04em] text-muted uppercase">in / out</span>
                        </span>
                      </td>
                      <td className={`${cell} whitespace-nowrap font-medium`}>{formatCost(s.cost_usd)}</td>
                      <td className={cell}>
                        <span className="flex max-w-48 flex-col items-start gap-1.5">
                          {s.status === 'stopped' ? (
                            <span className={`${pillClass} gap-1.5 bg-[#FBE7E2] text-danger`}>
                              <span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 rounded-full bg-danger" /> Stopped
                            </span>
                          ) : (
                            <span className={`${pillClass} gap-1.5 bg-teal-soft text-teal-dark`}>
                              <span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 rounded-full bg-teal" /> Active
                            </span>
                          )}
                          {s.stop_reason && <span className="text-xs leading-5 text-muted">{s.stop_reason}</span>}
                          {s.limits.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Hide' : 'Show'} limits for ${s.context_id}`}
                              onClick={() => setOpen(expanded ? null : key(s))}
                              className="inline-flex min-h-7 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-teal-dark underline decoration-teal/30 underline-offset-4"
                            >
                              {expanded ? 'Hide limits' : 'Show limits'}
                              <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none">
                                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </span>
                      </td>
                      <td className={cell}>
                        {s.events > 0 ? (
                          <Link to={`/audit?context_id=${encodeURIComponent(s.context_id)}`} className="inline-flex min-h-8 items-center rounded-md bg-warn-bg px-2.5 text-xs font-semibold text-warn-fg no-underline hover:bg-[#F6E3B6] hover:text-warn-fg">
                            {s.events} {s.events === 1 ? 'event' : 'events'}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">No events</span>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-line bg-teal-soft/45">
                        <td colSpan={HEADERS.length} className="px-5 py-5">
                          <div className="mb-3 flex items-baseline justify-between gap-4">
                            <h3 className="m-0 text-sm font-semibold">Enforced limits</h3>
                            <span className="text-xs text-muted">Current usage against configured caps</span>
                          </div>
                          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
                            {s.limits.map((l) => (
                              <li key={l.name} className="flex flex-col gap-2 text-sm">
                                <span className="text-xs text-muted">{l.name}: {l.used} / {l.max}{l.unit ? ` ${l.unit}` : ''}</span>
                                <progress value={Math.min(l.used, l.max)} max={l.max} aria-label={l.name} className="session-limit-meter h-2 w-full overflow-hidden rounded-full" />
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {sessions.hasNextPage && (
          <button type="button" className={`${buttonSecondary} self-start`} disabled={sessions.isFetchingNextPage} onClick={() => void sessions.fetchNextPage()}>
            {sessions.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h1 className="m-0 text-[32px] font-semibold tracking-[-0.025em]">Sessions</h1>
          <p className="m-0 max-w-[68ch] text-[15px] leading-6 text-muted">
            One row per A2A conversation (contextId) through the guarded URL. Counters only, no message content.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {live && <LiveBadge />}
          <button type="button" className={buttonSecondary} disabled={sessions.isFetching} onClick={() => void sessions.refetch()}>
            {sessions.isFetching && !sessions.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {sessions.isSuccess && list.length > 0 && (
        <section aria-label="Current session overview" className="grid overflow-hidden rounded-xl bg-sidebar text-white sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="flex min-h-28 flex-col justify-between gap-4 border-b border-white/10 px-5 py-4 sm:col-span-2 lg:col-span-1 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-sidebar-muted uppercase">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-bright" /> Current view
            </div>
            <p className="m-0 max-w-xs text-sm leading-5 text-[#D7D9DD]">
              {list.length} loaded {list.length === 1 ? 'session' : 'sessions'}, newest activity first.
            </p>
          </div>
          <dl className="contents">
            <div className="flex min-h-24 flex-col justify-center border-r border-white/10 px-5 py-4 sm:min-h-28">
              <dt className="text-xs text-sidebar-muted">Active in view</dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{activeCount}</dd>
            </div>
            <div className="flex min-h-24 flex-col justify-center px-5 py-4 sm:min-h-28 lg:border-r lg:border-white/10">
              <dt className="text-xs text-sidebar-muted">Stopped</dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{stoppedCount}</dd>
            </div>
            <div className="flex min-h-24 flex-col justify-center border-t border-r border-white/10 px-5 py-4 sm:min-h-28 lg:border-t-0">
              <dt className="text-xs text-sidebar-muted">Audit events</dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{eventCount}</dd>
            </div>
          </dl>
        </section>
      )}

      <section aria-labelledby="session-view-heading" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="session-view-heading" className="m-0 text-sm font-semibold">Session view</h2>
            <p className="mt-1 mb-0 text-xs text-muted">Narrow traffic by owner and enforcement state.</p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5 sm:flex-none">
              <label htmlFor="sessions-agent" className={labelClass}>Agent</label>
              <select id="sessions-agent" value={filters.agent_id ?? ''} onChange={(e) => setFilters((f) => ({ ...f, agent_id: e.target.value || undefined }))} className={inputClass}>
                <option value="">All agents</option>
                {agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:flex-none">
              <label htmlFor="sessions-status" className={labelClass}>Status</label>
              <select
                id="sessions-status"
                value={filters.status ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setFilters((f) => ({ ...f, status: value === 'active' || value === 'stopped' ? value : undefined }))
                }}
                className={inputClass}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
          </div>
        </div>
      </section>
      {content}
    </section>
  )
}
