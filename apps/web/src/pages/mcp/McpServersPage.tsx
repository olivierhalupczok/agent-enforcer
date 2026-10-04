import { useEffect, useRef, useState } from 'react'
import { useDeleteMcpServer, useMcpServers } from '../../api/mcpServers'
import type { McpServer } from '../../api/types'
import { buttonPrimary, buttonSecondary } from '../../ui/classes'
import { EmptyState, LoadingRows, PageHeader, PageShell, TableFrame } from '../../ui/Page'
import { RegisterMcpServerForm } from './RegisterMcpServerForm'

const HEADERS = ['Server', 'URL', 'Auth', 'Allowed tools', '']
const cell = 'px-5 py-4 align-middle'

function authSummary(auth: McpServer['auth']): string {
  if (auth.type === 'api_key') return `API key (${auth.header ?? 'Authorization'})`
  if (auth.type === 'oauth') return `OAuth (${auth.client_id ?? 'client'})`
  return 'None'
}

export function McpServersPage() {
  const servers = useMcpServers()
  const [registering, setRegistering] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const registerButtonRef = useRef<HTMLButtonElement>(null)
  const wasRegistering = useRef(false)

  // Give focus back to "Register MCP server" when the form closes.
  useEffect(() => {
    if (wasRegistering.current && !registering) registerButtonRef.current?.focus()
    wasRegistering.current = registering
  }, [registering])

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightId])

  let content
  if (servers.isError) {
    content = (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-6">
        <span className="text-sm">Couldn't load MCP servers.</span>
        <button type="button" className={buttonSecondary} onClick={() => void servers.refetch()}>
          Retry
        </button>
      </div>
    )
  } else if (servers.isPending) {
    content = <LoadingRows label="Loading MCP servers" />
  } else if (servers.data.length === 0) {
    content = (
      <EmptyState
        title="No MCP servers registered yet."
        description="Record a tool server and the exact tool names allowed on it."
        action={!registering ? (
          <button ref={registerButtonRef} type="button" className={buttonPrimary} onClick={() => setRegistering(true)}>
            Register MCP server
          </button>
        ) : undefined}
      />
    )
  } else {
    content = <McpServersTable servers={servers.data} highlightId={highlightId} />
  }

  return (
    <PageShell>
      <PageHeader
        title="MCP servers"
        description="Registered tool servers and configured tool allowlists. Credentials are stored by the hub and never shown again."
        actions={servers.isSuccess && servers.data.length > 0 && !registering ? (
          <button ref={registerButtonRef} type="button" className={buttonPrimary} onClick={() => setRegistering(true)}>
            Register MCP server
          </button>
        ) : undefined}
      />
      {registering && (
        <RegisterMcpServerForm
          onClose={() => setRegistering(false)}
          onRegistered={(server) => setHighlightId(server.id)}
        />
      )}
      {content}
    </PageShell>
  )
}

function McpServersTable({ servers, highlightId }: { servers: readonly McpServer[]; highlightId: string | null }) {
  const remove = useDeleteMcpServer()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const restoreFocusId = useRef<string | null>(null)
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (confirmingId !== null || !restoreFocusId.current) return
    deleteButtons.current.get(restoreFocusId.current)?.focus()
    restoreFocusId.current = null
  }, [confirmingId])

  const cancelDelete = (id: string) => {
    restoreFocusId.current = id
    setConfirmingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {remove.isError && (
        <p role="alert" className="m-0 text-sm text-danger">
          {remove.error.message}
        </p>
      )}
      <TableFrame label="MCP servers table">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead className="bg-[#F9F9F6]">
            <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
              {HEADERS.map((header, i) => (
                <th key={header || i} scope="col" className="px-5 py-3.5 font-semibold">
                  {header || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => {
              const highlighted = server.id === highlightId
              return (
                <tr
                  key={server.id}
                  data-highlight={highlighted}
                  className={`border-b border-line transition-colors last:border-b-0 ${highlighted ? 'bg-teal-soft' : 'hover:bg-[#FAFAF7]'}`}
                >
                  <th scope="row" className={`${cell} font-semibold`}>
                    {server.name}
                  </th>
                  <td className={`${cell} font-mono text-[13px] break-all text-muted`}>{server.url}</td>
                  <td className={`${cell} whitespace-nowrap ${server.auth.type === 'none' ? 'text-muted' : ''}`}>
                    {authSummary(server.auth)}
                  </td>
                  <td className={cell}>
                    <ul aria-label={`Tools of ${server.name}`} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {server.allowed_tools.map((tool) => (
                        <li key={tool} className="rounded-md bg-canvas px-2 py-0.5 font-mono text-xs">
                          {tool}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${cell} text-right`}>
                    {confirmingId === server.id ? (
                      <div role="group" aria-label={`Delete ${server.name}?`} className="flex justify-end gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          autoFocus
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(server.id, { onSettled: () => setConfirmingId(null) })}
                          aria-label={`Confirm delete ${server.name}`}
                          className={`${buttonSecondary} border-danger px-3 text-xs text-danger hover:bg-[#FBE7E2]`}
                        >
                          {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => cancelDelete(server.id)}
                          aria-label={`Cancel delete ${server.name}`}
                          className={`${buttonSecondary} px-3 text-xs`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        ref={(node) => {
                          if (node) deleteButtons.current.set(server.id, node)
                          else deleteButtons.current.delete(server.id)
                        }}
                        type="button"
                        aria-label={`Delete ${server.name}`}
                        onClick={() => {
                          remove.reset()
                          setConfirmingId(server.id)
                        }}
                        className={`${buttonSecondary} px-3 text-xs`}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableFrame>
    </div>
  )
}
