import { useState } from 'react'
import { Link } from 'react-router'
import { useAgents } from '../../api/agents'
import {
  useRunSecurityScan,
  useSecurityScan,
  useSecurityScans,
  type ProbeResult,
  type ScanListItem,
} from '../../api/security'
import { buttonPrimary, buttonSecondary, inputClass } from '../../ui/classes'
import { EmptyState, LoadingRows, PageHeader, PageShell } from '../../ui/Page'
import { LoadError } from '../ApiUnavailable'
import { Scorecard } from './Scorecard'

function count(results: ProbeResult[], run: 'unguarded' | 'guarded') {
  return results.filter((r) => r[run].verdict === 'vulnerable').length
}

function Headline({ results, total }: { results: ProbeResult[]; total: number }) {
  const unguarded = count(results, 'unguarded')
  const guarded = count(results, 'guarded')
  const stopped = results.filter((r) => r.unguarded.verdict === 'vulnerable' && r.guarded.verdict === 'defended').length
  const stats = [
    { label: 'Attacks that worked without the hub', value: `${unguarded} / ${total}`, tone: 'text-[#FFB4A8]' },
    { label: 'Attacks that worked with guardrails', value: `${guarded} / ${total}`, tone: guarded ? 'text-[#FFB4A8]' : 'text-teal-bright' },
    { label: 'Stopped by guardrails', value: String(stopped), tone: 'text-teal-bright' },
  ]
  return (
    <dl aria-label="Scan score" className="m-0 grid overflow-hidden rounded-xl bg-sidebar text-white sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="flex min-h-28 flex-col justify-center gap-1 border-b border-white/10 px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
          <dt className="text-xs font-semibold text-sidebar-muted">{s.label}</dt>
          <dd className={`m-0 text-2xl font-semibold tracking-[-0.02em] tabular-nums ${s.tone}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function History({ scans, selected, onSelect }: { scans: ScanListItem[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <section aria-labelledby="scan-history" className="flex flex-col gap-3">
      <div>
        <h2 id="scan-history" className="m-0 text-base font-semibold">Past scans</h2>
        <p className="mt-1 mb-0 text-xs leading-5 text-muted">Open a saved result for this agent.</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {scans.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selected === s.id}
              onClick={() => onSelect(s.id)}
              className={`${buttonSecondary} flex h-auto min-h-11 w-full flex-col items-start gap-1 px-3 py-2 text-left aria-pressed:border-teal aria-pressed:bg-teal-soft`}
            >
              <span className="text-xs font-semibold">{new Date(s.createdAt).toLocaleString()}</span>
              <span className="text-xs leading-5 text-muted">
                {s.summary.unguarded.vulnerable} → {s.summary.guarded.vulnerable} of {s.summary.total} attacks worked
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** SEC-01: OWASP LLM Top 10 (2025) attacks against an agent, without and with its guardrails. */
export function SecurityPage() {
  const agents = useAgents()
  const [pickedAgentId, setPickedAgentId] = useState('')
  const agentId = pickedAgentId || agents.data?.[0]?.id || ''
  const { live, run, reset } = useRunSecurityScan()
  const history = useSecurityScans(agentId)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const saved = useSecurityScan(live.running || live.scan ? null : selectedScanId)

  const showingLive = live.running || live.results.length > 0 || live.error !== null
  const view = showingLive
    ? { categories: live.categories, staticChecks: live.staticChecks, results: live.results, total: live.total }
    : saved.data
      ? {
          categories: saved.data.categories,
          staticChecks: saved.data.staticChecks,
          results: saved.data.results,
          total: saved.data.summary.total,
        }
      : null

  const pickAgent = (id: string) => {
    setPickedAgentId(id)
    setSelectedScanId(null)
    reset()
  }
  const showSaved = (id: string) => {
    reset()
    setSelectedScanId(id)
  }

  return (
    <PageShell>
      <PageHeader
        title="Security scan"
        description={
          <>
          Runs the OWASP Top 10 for LLM Applications (2025) attacks against an agent twice: straight to the agent, then
          through its guardrails.
          </>
        }
      />

      {agents.isPending ? (
        <LoadingRows label="Loading agents" count={2} />
      ) : agents.isError ? (
        <LoadError what="agents" error={agents.error} onRetry={() => void agents.refetch()} />
      ) : !agentId ? (
        <EmptyState
          title="No agents yet"
          description="Register an agent before running a security scan."
          action={<Link to="/agents" className="text-sm font-semibold underline decoration-teal/30 underline-offset-4">Register an agent</Link>}
        />
      ) : (
        <>
          <section aria-labelledby="scan-setup-heading" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="scan-setup-heading" className="m-0 text-sm font-semibold">Scan setup</h2>
                <p className="mt-1 mb-0 text-xs text-muted">Choose one registered agent and run both probe paths.</p>
              </div>
              <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
                <div className="flex min-w-60 flex-1 flex-col gap-1.5 sm:flex-none">
                  <label htmlFor="scan-agent" className="text-[13px] font-semibold text-[#30343B]">
                    Agent
                  </label>
                  <select
                    id="scan-agent"
                    value={agentId}
                    disabled={live.running}
                    onChange={(e) => pickAgent(e.target.value)}
                    className={inputClass}
                  >
                    {agents.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className={buttonPrimary} disabled={live.running} onClick={() => void run(agentId)}>
                  {live.running ? 'Scanning…' : 'Run scan'}
                </button>
              </div>
            </div>
          </section>

          {(live.running || live.scan) && (
            <p role="status" className="m-0 text-sm text-muted">
              {live.running
                ? `Attacking… ${live.results.length} of ${live.total || '…'} probes done`
                : `Scan finished: ${live.scan?.summary.total} probes, each sent twice.`}
            </p>
          )}
          {!live.judge && showingLive && (
            <p className="m-0 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">
              No LLM judge on this API, so attacks only a judge can grade are marked inconclusive.
            </p>
          )}
          {live.warning && <p className="m-0 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">{live.warning}</p>}
          {live.error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {live.error}
            </p>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <main className="flex min-w-0 flex-col gap-5">
              {selectedScanId && saved.isPending ? (
                <LoadingRows label="Loading saved scan" count={3} />
              ) : selectedScanId && saved.isError ? (
                <LoadError what="saved scan" error={saved.error} onRetry={() => void saved.refetch()} />
              ) : view ? (
                <>
                  {view.results.length > 0 && <Headline results={view.results} total={view.total} />}
                  {view.categories.length > 0 && (
                    <Scorecard
                      categories={view.categories}
                      staticChecks={view.staticChecks}
                      results={view.results}
                      pending={showingLive ? live.probes : []}
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  title="No scan selected"
                  description="Run a scan, or open a saved scan from the history."
                />
              )}
            </main>

            <aside className="order-first rounded-xl border border-line bg-surface p-4 sm:p-5 lg:order-last">
              {history.isPending ? (
                <div role="status" aria-label="Loading scan history" className="flex flex-col gap-3">
                  <span className="sr-only">Loading scan history…</span>
                  <span className="h-4 w-24 rounded-full bg-line" />
                  <span className="h-14 rounded-lg bg-canvas" />
                  <span className="h-14 rounded-lg bg-canvas" />
                </div>
              ) : history.isError ? (
                <LoadError what="scan history" error={history.error} onRetry={() => void history.refetch()} />
              ) : history.data.length > 0 ? (
                <History scans={history.data} selected={showingLive ? null : selectedScanId} onSelect={showSaved} />
              ) : (
                <section aria-labelledby="scan-history" className="flex flex-col gap-1">
                  <h2 id="scan-history" className="m-0 text-base font-semibold">Past scans</h2>
                  <p className="m-0 text-sm leading-6 text-muted">No saved scans for this agent yet.</p>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </PageShell>
  )
}
