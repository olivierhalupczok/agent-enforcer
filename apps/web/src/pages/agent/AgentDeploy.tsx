import { useState } from 'react'
import { useCreateGatewayKey } from '../../api/agents'
import type { Agent } from '../../api/types'
import { buttonPrimary, buttonSecondary } from '../../ui/classes'

const KEY_PLACEHOLDER = '$GUARDRAIL_HUB_KEY'

/** The guarded A2A endpoint (B-01). The gateway sits at the API root (/a/{id}), which the web host
 * forwards to the API like /api, so the panel's own origin is the address callers use. */
function gatewayUrls(agentId: string, paths?: { gateway_path: string; agent_card_path: string }) {
  const origin = window.location.origin
  const gateway = paths?.gateway_path ?? `/a/${encodeURIComponent(agentId)}`
  const card = paths?.agent_card_path ?? `${gateway}/.well-known/agent-card.json`
  return { gateway: origin + gateway, card: origin + card }
}

function curlExample(url: string, key: string): string {
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'SendMessage',
    params: { message: { messageId: 'msg-1', contextId: 'ctx-1', role: 'ROLE_USER', parts: [{ text: 'Hello' }] } },
  }
  const keyArg = key === KEY_PLACEHOLDER ? `"X-API-Key: ${key}"` : `'X-API-Key: ${key}'`
  return [
    `curl -X POST '${url}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H ${keyArg} \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join('\n')
}

export function AgentDeploy({ agent }: { agent: Agent }) {
  const createKey = useCreateGatewayKey(agent.id)
  const [status, setStatus] = useState('')
  const [confirming, setConfirming] = useState(false)
  const created = createKey.data
  const urls = gatewayUrls(agent.id, created)
  const key = created?.key ?? KEY_PLACEHOLDER

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`${label} copied.`)
    } catch {
      setStatus(`Couldn't copy the ${label.toLowerCase()}. Select it and copy it by hand.`)
    }
  }

  const create = () => {
    setConfirming(false)
    setStatus('')
    createKey.mutate(undefined, {
      onSuccess: () => setStatus('Gateway key created. Store it now, it won’t be shown again.'),
    })
  }

  return (
    <section
      aria-labelledby="agent-deploy-title"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="agent-deploy-title" className="m-0 text-lg font-semibold">
          Deploy
        </h2>
        <p className="m-0 text-sm text-muted">
          Callers reach this agent through the hub's guardrails at the guarded URL, with a gateway key in
          the <code>X-API-Key</code> header.
        </p>
      </div>
      {status && (
        <p role="status" className="m-0 rounded-lg bg-teal-soft px-3 py-2 text-sm text-teal-dark">
          {status}
        </p>
      )}

      <dl className="m-0 flex flex-col gap-3">
        <CopyField label="Guarded URL" value={urls.gateway} onCopy={copy} />
        <CopyField label="Agent Card" value={urls.card} onCopy={copy} />
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Gateway key</h3>
        {created ? (
          <div className="flex flex-col gap-2 rounded-lg bg-warn-bg p-3 text-warn-fg">
            <p className="m-0 text-sm font-semibold">Store it now, it won’t be shown again.</p>
            <dl className="m-0">
              <CopyField label="Key" value={created.key} onCopy={copy} />
            </dl>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">
            Creating a key replaces the previous one; callers using it stop working.
          </p>
        )}
        {createKey.isError && (
          <p role="alert" className="m-0 text-sm text-danger">
            {createKey.error.message}
          </p>
        )}
        {confirming ? (
          <div role="group" aria-label="Confirm gateway key replacement" className="flex flex-col items-start gap-3 rounded-lg border border-amber/40 bg-warn-bg p-3 text-warn-fg sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm font-semibold">Creating a key replaces the previous one; callers using it stop working.</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className={buttonSecondary} onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className={buttonPrimary} disabled={createKey.isPending} onClick={create}>
                {createKey.isPending ? 'Creating…' : 'Create another key'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className={created ? buttonSecondary : buttonPrimary}
              disabled={createKey.isPending}
              onClick={created ? () => setConfirming(true) : create}
            >
              {createKey.isPending ? 'Creating…' : created ? 'Create another key' : 'Create key'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="agent-deploy-example" className="m-0 text-sm font-semibold">
            Example
          </h3>
          <button
            type="button"
            className={`${buttonSecondary} px-3 text-xs`}
            onClick={() => void copy('Example', curlExample(urls.gateway, key))}
          >
            Copy example
          </button>
        </div>
        <pre
          aria-labelledby="agent-deploy-example"
          className="m-0 max-w-full overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-xs whitespace-pre"
        >
          {curlExample(urls.gateway, key)}
        </pre>
      </div>
    </section>
  )
}

interface CopyFieldProps {
  label: string
  value: string
  onCopy: (label: string, text: string) => Promise<void>
}

function CopyField({ label, value, onCopy }: CopyFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[13px] font-semibold text-[#30343B]">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-canvas px-2 py-1 text-xs whitespace-nowrap">{value}</code>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          className={`${buttonSecondary} min-h-9 self-start px-3 text-xs sm:self-auto`}
          onClick={() => void onCopy(label, value)}
        >
          Copy
        </button>
      </dd>
    </div>
  )
}
