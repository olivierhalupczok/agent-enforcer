import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { agentKeys, useAgent, useDeleteAgent } from '../../api/agents'
import { ApiError } from '../../api/client'
import { buttonPrimary, buttonSecondary } from '../../ui/classes'
import { LoadingRows, PageHeader, PageShell } from '../../ui/Page'
import { AgentDeploy } from './AgentDeploy'
import { AgentGuardrails } from './AgentGuardrails'
import { AgentMcpServers } from './AgentMcpServers'
import { AgentOverview } from './AgentOverview'
import { EditAgentForm } from './EditAgentForm'

const backLink = 'inline-flex min-h-11 items-center text-sm font-semibold no-underline'

export function AgentPage() {
  const { agentId = '' } = useParams()
  const agent = useAgent(agentId)
  const [editing, setEditing] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const remove = useDeleteAgent()
  const [confirming, setConfirming] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  const deleteError =
    remove.error instanceof ApiError && remove.error.status === 405
      ? "Deleting agents isn't available on this API yet."
      : remove.error?.message

  if (agent.isPending) {
    return (
      <PageShell>
        <PageHeader title="Loading agent…" />
        <div aria-busy="true">
          <LoadingRows label="Loading agent details" count={3} />
        </div>
      </PageShell>
    )
  }

  if (agent.isError) {
    const notFound = agent.error instanceof ApiError && (agent.error.status === 404 || agent.error.status === 422)
    return notFound ? (
      <PageShell>
        <PageHeader
          title="Agent not found"
          actions={
            <Link to="/agents" className={backLink}>
              Back to agents
            </Link>
          }
        />
      </PageShell>
    ) : (
      <PageShell>
        <PageHeader title="Agent details" />
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <span className="text-sm">Couldn't load this agent.</span>
          <button type="button" className={buttonSecondary} onClick={() => void agent.refetch()}>
            Retry
          </button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Link to="/agents" className={`${backLink} -mb-5 self-start`}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="mr-1.5 h-4 w-4" fill="none">
          <path d="m9.5 3.5-4.5 4.5 4.5 4.5M5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Agents
      </Link>
      <PageHeader
        title={agent.data.name}
        description={agent.data.description || undefined}
        actions={
          !editing && (
            confirming ? (
              <div
                role="group"
                aria-label="Confirm agent deletion"
                className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-danger/30 bg-[#FBE7E2] p-2"
              >
                <span className="px-1 text-sm font-semibold text-danger">Delete this agent?</span>
                <button
                  type="button"
                  className={buttonSecondary}
                  disabled={remove.isPending}
                  onClick={() => {
                    setConfirming(false)
                    requestAnimationFrame(() => deleteButtonRef.current?.focus())
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  autoFocus
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(agent.data.id, {
                      onSuccess: (_, id) => {
                        navigate('/agents')
                        // After leaving the page (removing it while mounted would refetch → 404 flash),
                        // so browser Back doesn't show the deleted agent from cache.
                        setTimeout(() => queryClient.removeQueries({ queryKey: agentKeys.agent(id), exact: true }))
                      },
                    })
                  }
                  className={`${buttonSecondary} border-danger text-danger`}
                >
                  {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  ref={editButtonRef}
                  type="button"
                  className={buttonPrimary}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                <button
                  ref={deleteButtonRef}
                  type="button"
                  className={buttonSecondary}
                  onClick={() => setConfirming(true)}
                >
                  Delete
                </button>
              </div>
            )
          )
        }
      />
      <div className="flex flex-col gap-6">
        {deleteError && (
          <p role="alert" className="m-0 text-sm text-danger">
            {deleteError}
          </p>
        )}
        {editing ? (
          <EditAgentForm agent={agent.data} onClose={() => setEditing(false)} />
        ) : (
          <AgentOverview agent={agent.data} />
        )}
        <AgentGuardrails agent={agent.data} />
        <AgentMcpServers agent={agent.data} />
        <AgentDeploy agent={agent.data} />
      </div>
    </PageShell>
  )
}
