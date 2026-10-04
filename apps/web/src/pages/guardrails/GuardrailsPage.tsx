import { useEffect, useRef, useState } from 'react'
import { useGuardrailTemplates, useGuardrails } from '../../api/guardrails'
import { buttonPrimary, buttonSecondary } from '../../ui/classes'
import { EmptyState, PageHeader, PageShell } from '../../ui/Page'
import { GuardrailCard } from './GuardrailCard'
import { NewGuardrailForm } from './NewGuardrailForm'
import { SignaturesSection } from './SignaturesSection'

export function GuardrailsPage() {
  const templates = useGuardrailTemplates()
  const guardrails = useGuardrails()
  const [creating, setCreating] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const wasCreating = useRef(false)

  // Give focus back to "New guardrail" when the form closes.
  useEffect(() => {
    if (wasCreating.current && !creating) newButtonRef.current?.focus()
    wasCreating.current = creating
  }, [creating])

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightId])

  const loaded = templates.isSuccess && guardrails.isSuccess

  let content
  if (templates.isError || guardrails.isError) {
    content = (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
        <span className="text-sm">Couldn't load guardrails.</span>
        <span className="text-[13px] text-muted">
          Is the API running? Start it with <code className="font-mono">make api</code>.
        </span>
        <div>
          <button
            type="button"
            className={buttonSecondary}
            disabled={templates.isFetching || guardrails.isFetching}
            onClick={() => {
              void templates.refetch()
              void guardrails.refetch()
            }}
          >
            {templates.isFetching || guardrails.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    )
  } else if (!loaded) {
    content = (
      <div role="status" aria-label="Loading guardrails" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <span className="sr-only">Loading guardrails…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-56 flex-col gap-4 rounded-xl border border-line bg-surface p-5">
            <span className="h-4 w-2/3 rounded-full bg-line" />
            <span className="h-3 w-full rounded-full bg-line" />
            <span className="h-3 w-4/5 rounded-full bg-line" />
            <span className="mt-2 h-6 w-1/2 rounded-md bg-line" />
            <span className="mt-auto h-11 w-full rounded-lg bg-line" />
          </div>
        ))}
      </div>
    )
  } else if (guardrails.data.length === 0) {
    content = (
      <EmptyState
        title="No guardrails yet"
        description="Create a guardrail to check text going to or from a proxy agent."
        action={
          <button ref={newButtonRef} type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
            New guardrail
          </button>
        }
      />
    )
  } else {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {guardrails.data.map((g) => (
          <GuardrailCard key={g.id} guardrail={g} highlighted={g.id === highlightId} />
        ))}
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Guardrails"
        description="Single checks on text going to or from a proxy agent. Each one runs on exactly one engine."
        actions={
          loaded && !creating && guardrails.data.length > 0 ? (
            <button ref={newButtonRef} type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
              New guardrail
            </button>
          ) : undefined
        }
      />
      {creating && templates.data && (
        <NewGuardrailForm
          templates={templates.data}
          onClose={() => setCreating(false)}
          onCreated={(guardrail) => setHighlightId(guardrail.id)}
        />
      )}
      <section aria-labelledby="configured-guardrails-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="configured-guardrails-heading" className="m-0 text-lg font-semibold">Configured guardrails</h2>
            <p className="mt-1 mb-0 text-sm text-muted">Review each check's engine, stage, action, and availability.</p>
          </div>
          {loaded && guardrails.data.length > 0 && (
            <span className="text-sm text-muted tabular-nums">{guardrails.data.length} total</span>
          )}
        </div>
        {content}
      </section>
      <SignaturesSection />
    </PageShell>
  )
}
