import { useState } from 'react'
import { Link } from 'react-router'
import type { RunResult, Scenario } from '../../api/playground'
import { usePlaygroundHosts, useResetSandbox, useRunScenario, useScenarios } from '../../api/playground'
import { buttonPrimary, buttonSecondary } from '../../ui/classes'
import { EmptyState, PageHeader, PageShell } from '../../ui/Page'

const EXPECTED_LABELS: Record<Scenario['expected'], { label: string; className: string }> = {
  blocked: { label: 'Expected: blocked', className: 'bg-[#FBE7E2] text-danger' },
  redacted: { label: 'Expected: redacted', className: 'bg-warn-bg text-warn-fg' },
  flagged: { label: 'Expected: flagged + URL auto-banned', className: 'bg-warn-bg text-warn-fg' },
  passes: { label: 'Expected: passes', className: 'bg-teal-soft text-teal-dark' },
}

export function PlaygroundPage() {
  const scenarios = useScenarios()
  const hosts = usePlaygroundHosts()
  const [host, setHost] = useState<string | null>(null) // null = first option once loaded
  const [results, setResults] = useState<Record<string, RunResult | 'running'>>({})
  const [resetStatus, setResetStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const run = useRunScenario()
  const reset = useResetSandbox()

  const selectedHost = host ?? hosts.data?.[0]?.id ?? ''
  const anyRunning = Object.values(results).some((r) => r === 'running') || reset.isPending

  const doReset = () => {
    setResetStatus(null)
    reset.mutate(undefined, {
      onSuccess: (res) =>
        setResetStatus({ kind: 'success', message: `Sandbox restored (${res.staged.length} files re-created).` }),
      onError: (error) =>
        setResetStatus({ kind: 'error', message: (error as { message?: string }).message ?? 'Reset failed.' }),
    })
  }

  const startRun = (scenarioId: string) => {
    if (anyRunning || !selectedHost) return
    setResults((prev) => ({ ...prev, [scenarioId]: 'running' }))
    run.mutate(
      { scenarioId, host: selectedHost },
      {
        onSuccess: (result) => setResults((prev) => ({ ...prev, [scenarioId]: result })),
        onError: (error) =>
          setResults((prev) => ({
            ...prev,
            [scenarioId]: {
              scenarioId,
              host: selectedHost,
              exitCode: null,
              durationMs: 0,
              stdout: '',
              stderr: (error as { message?: string }).message ?? 'Run failed.',
              timedOut: false,
            },
          })),
      },
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Playground"
        actions={
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
              <span className="text-xs font-semibold text-[#30343B]">Simulated host</span>
              <select
                aria-label="Simulated host"
                className="min-h-11 min-w-0 rounded-lg border border-[#CFCFC8] bg-surface px-3 text-sm text-ink sm:min-w-48"
                value={selectedHost}
                disabled={hosts.isPending || hosts.isError || !hosts.data?.length || anyRunning}
                onChange={(e) => {
                  setHost(e.target.value)
                  setResults({})
                }}
              >
                {!selectedHost && <option value="">No hosts available</option>}
                {(hosts.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[#30343B]">Sandbox</span>
              <button type="button" className={buttonSecondary} disabled={reset.isPending || anyRunning} onClick={doReset}>
                {reset.isPending ? 'Restoring…' : 'Reset sandbox'}
              </button>
            </div>
          </div>
        }
      />

      {(scenarios.isError || hosts.isError) && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[#EFC4BC] bg-[#FBEAE6] p-4 text-sm text-danger">
          <span>Couldn't load {scenarios.isError && hosts.isError ? 'playground scenarios or hosts' : scenarios.isError ? 'playground scenarios' : 'playground hosts'}.</span>
          <span>Check that the API is running, then retry.</span>
          <div>
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => {
                if (scenarios.isError) void scenarios.refetch()
                if (hosts.isError) void hosts.refetch()
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {resetStatus && (
        <div
          role={resetStatus.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-sm ${
            resetStatus.kind === 'error'
              ? 'border-[#EFC4BC] bg-[#FBEAE6] text-danger'
              : 'border-[#BFE3D2] bg-[#EAF6F0] text-[#0B5A51]'
          }`}
        >
          {resetStatus.message}
        </div>
      )}

      <div className="rounded-xl border border-[#EAD3A2] bg-warn-bg p-4 text-sm text-warn-fg">
        <b>How to demo:</b> run a failing scenario (it should be blocked or redacted per the policy), open{' '}
        <Link to="/policies" className="font-semibold underline">
          Policies
        </Link>{' '}
        and relax the matching rule (the hint on each card says which), so the scenario passes. Supports hot reload, no need to restart. Repopulate the files if needed.
      </div>

      {scenarios.isPending ? (
        <div aria-busy="true" className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : scenarios.data?.length === 0 ? (
        <EmptyState title="No demo scenarios available" description="No predefined scenarios were returned by the API." />
      ) : scenarios.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {scenarios.data.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              disabled={anyRunning || run.isPending || !selectedHost}
              result={results[scenario.id]}
              onRun={() => startRun(scenario.id)}
            />
          ))}
        </div>
      ) : null}
    </PageShell>
  )
}

function ScenarioCard({
  scenario,
  disabled,
  result,
  onRun,
}: {
  scenario: Scenario
  disabled: boolean
  result: RunResult | 'running' | undefined
  onRun: () => void
}) {
  const expected = EXPECTED_LABELS[scenario.expected]
  return (
    <article
      aria-label={scenario.title}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">{scenario.title}</h2>
        <span className={`inline-flex shrink-0 rounded-md px-2.5 py-0.5 text-xs font-semibold ${expected.className}`}>
          {expected.label}
        </span>
      </div>
      <p className="m-0 text-[13px] text-muted">{scenario.hint}</p>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none">Exact prompt sent to the agent</summary>
        <code className="mt-2 block rounded bg-canvas p-2 font-mono whitespace-pre-wrap">{scenario.prompt}</code>
      </details>
      <div className="mt-auto">
        <button type="button" className={buttonPrimary} disabled={disabled} onClick={onRun}>
          {result === 'running' ? 'Running…' : 'Run scenario'}
        </button>
      </div>
      {result === 'running' && (
        <div aria-busy="true" className="animate-pulse rounded-lg border border-line bg-canvas p-3 text-xs text-muted">
          The agent is working on it. Usually done in a few seconds.
        </div>
      )}
      {result && result !== 'running' && <RunTranscript result={result} />}
    </article>
  )
}

function RunTranscript({ result }: { result: RunResult }) {
  const failed = result.timedOut || result.stderr !== ''
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {result.exitCode !== null && <span>exit code {result.exitCode}</span>}
        {result.durationMs > 0 && <span>{(result.durationMs / 1000).toFixed(1)}s</span>}
        {result.timedOut && <span className="font-semibold text-danger">timed out</span>}
        {result.host && <span>host {result.host}</span>}
      </div>
      {result.stdout && (
        <pre className="m-0 max-h-64 overflow-auto rounded bg-surface p-2 font-mono text-[12.5px] whitespace-pre-wrap">
          {result.stdout}
        </pre>
      )}
      {result.stderr && (
        <pre className="m-0 max-h-40 overflow-auto rounded bg-[#FBE7E2] p-2 font-mono text-[12.5px] whitespace-pre-wrap text-danger">
          {result.stderr}
        </pre>
      )}
      {!result.stdout && !result.stderr && !failed && (
        <span className="text-xs text-muted">(no output)</span>
      )}
    </div>
  )
}
