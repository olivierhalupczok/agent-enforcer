import { useSearchParams } from 'react-router'
import { useAgents } from '../../api/agents'
import { useAuditEvents, useAuditRules, useLiveRefresh } from '../../api/audit'
import type { AuditAction, AuditEvent, AuditFilters } from '../../api/types'
import { badgeClass, buttonSecondary, inputClass } from '../../ui/classes'
import { formatTime, shortId } from '../../ui/format'
import { LiveBadge } from '../../ui/LiveBadge'
import { EmptyState, LoadingRows, PageHeader, PageShell, TableFrame } from '../../ui/Page'
import { LoadError } from '../ApiUnavailable'

const ACTIONS: Record<AuditAction, { label: string; className: string }> = {
  block: { label: 'Block', className: 'bg-[#FBE7E2] text-danger' },
  redact: { label: 'Redact', className: 'bg-warn-bg text-warn-fg' },
  warn: { label: 'Warn', className: 'bg-warn-bg text-warn-fg' },
}
const FILTER_KEYS = ['agent_id', 'rule_id', 'action', 'context_id'] as const
const HEADERS = ['Time', 'Agent', 'Session', 'Rule', 'Stage', 'Result', 'Config', 'Details']
const cell = 'px-4 py-3 align-top'
const labelClass = 'text-[13px] font-semibold text-[#30343B]'

function readFilters(params: URLSearchParams): AuditFilters {
  const action = params.get('action')
  return {
    agent_id: params.get('agent_id') || undefined,
    rule_id: params.get('rule_id') || undefined,
    action: action === 'block' || action === 'redact' || action === 'warn' ? action : undefined,
    context_id: params.get('context_id') || undefined,
  }
}

export function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const events = useAuditEvents(filters)
  const rules = useAuditRules()
  const agents = useAgents()
  const live = useLiveRefresh(['audit_events'], [['audit-events'], ['audit-rules']])
  const filtered = FILTER_KEYS.some((key) => filters[key])

  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const agentName = (event: AuditEvent) =>
    event.agent_name ?? agents.data?.find((a) => a.id === event.agent_id)?.name ?? event.agent_id
  const list = events.data?.pages.flatMap((page) => page.data) ?? []
  const guardrailRules = rules.data?.filter((r) => r.kind === 'guardrail') ?? []
  const limitRules = rules.data?.filter((r) => r.kind === 'limit') ?? []

  let content
  if (events.isError) {
    content = <LoadError what="audit events" error={events.error} onRetry={() => void events.refetch()} />
  } else if (events.isPending) {
    content = <LoadingRows label="Loading audit events" count={4} />
  } else if (list.length === 0) {
    content = (
      <EmptyState
        title={filtered ? 'No matching events' : 'No audit events yet'}
        description={
          filtered
            ? 'No events match these filters.'
            : 'No audit events yet. Blocks, redactions, warnings and limit hits appear here.'
        }
        action={
          filtered ? (
            <button type="button" className={buttonSecondary} onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          ) : undefined
        }
      />
    )
  } else {
    content = (
      <>
        <TableFrame label="Audit events table">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm tabular-nums">
            <thead className="bg-[#F9F9F6]">
              <tr className="border-b border-line text-xs tracking-[0.04em] text-muted uppercase">
                {HEADERS.map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((event) => (
                <tr key={event.id} className="border-b border-line transition-colors hover:bg-[#FAFAF7] last:border-b-0">
                  <td className={`${cell} whitespace-nowrap text-muted`}>{formatTime(event.at)}</td>
                  <td className={cell}>{agentName(event)}</td>
                  <td className={`${cell} font-mono text-xs`} title={event.context_id ?? undefined}>
                    {event.context_id ? shortId(event.context_id) : '—'}
                  </td>
                  <td className={cell}>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{event.rule_name}</span>
                      <span className="text-xs text-muted">{event.kind === 'limit' ? 'Limit' : 'Guardrail'}</span>
                    </span>
                  </td>
                  <td className={`${cell} text-muted`}>{event.stage ?? '—'}</td>
                  <td className={cell}>
                    <span className={`${badgeClass} ${ACTIONS[event.action].className}`}>{ACTIONS[event.action].label}</span>
                  </td>
                  <td className={`${cell} font-mono text-xs text-muted`}>{event.config_version ?? '—'}</td>
                  <td className={`${cell} max-w-80`}>{event.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
        {events.hasNextPage && (
          <button type="button" className={`${buttonSecondary} self-start`} disabled={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()}>
            {events.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Audit log"
        description="Every block, redaction, warning and limit hit, newest first."
        actions={
          <>
            {live && <LiveBadge />}
            <button type="button" className={buttonSecondary} disabled={events.isFetching} onClick={() => void events.refetch()}>
              {events.isFetching && !events.isPending ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      <section aria-labelledby="audit-filters-heading" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="audit-filters-heading" className="m-0 text-sm font-semibold">Event view</h2>
            <p className="mt-1 mb-0 text-xs text-muted">Narrow events by agent, rule, result, or linked session.</p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-3 lg:w-auto">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5 lg:flex-none">
          <label htmlFor="audit-agent" className={labelClass}>Agent</label>
          <select id="audit-agent" value={filters.agent_id ?? ''} onChange={(e) => setFilter('agent_id', e.target.value)} className={inputClass}>
            <option value="">All agents</option>
            {agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5 lg:flex-none">
          <label htmlFor="audit-rule" className={labelClass}>Rule</label>
          <select id="audit-rule" value={filters.rule_id ?? ''} onChange={(e) => setFilter('rule_id', e.target.value)} className={inputClass}>
            <option value="">All rules</option>
            {guardrailRules.length > 0 && (
              <optgroup label="Guardrails">
                {guardrailRules.map((r) => <option key={r.rule_id} value={r.rule_id}>{r.rule_name}</option>)}
              </optgroup>
            )}
            {limitRules.length > 0 && (
              <optgroup label="Limits">
                {limitRules.map((r) => <option key={r.rule_id} value={r.rule_id}>{r.rule_name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1.5 lg:flex-none">
          <label htmlFor="audit-action" className={labelClass}>Result</label>
          <select id="audit-action" value={filters.action ?? ''} onChange={(e) => setFilter('action', e.target.value)} className={inputClass}>
            <option value="">All results</option>
            <option value="block">Block</option>
            <option value="redact">Redact</option>
            <option value="warn">Warn</option>
          </select>
        </div>
        {filters.context_id && (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-canvas px-3 text-sm">
            Session <code className="text-xs">{shortId(filters.context_id)}</code>
            <button type="button" aria-label={`Remove session filter ${filters.context_id}`} onClick={() => setFilter('context_id', '')} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted hover:bg-line hover:text-ink">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        )}
        {filtered && (
          <button type="button" className={buttonSecondary} onClick={() => setParams(new URLSearchParams())}>Clear filters</button>
        )}
          </div>
        </div>
      </section>

      {content}
    </PageShell>
  )
}
