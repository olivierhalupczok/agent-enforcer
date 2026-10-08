import { PageHeader, buttonPrimary, buttonSecondary } from 'web'

export const WithAction = () => (
  <div className="bg-canvas p-6">
    <PageHeader
      title="Guardrails"
      description="Single checks on text going to or from a proxy agent. Each one runs on exactly one engine."
      actions={
        <button type="button" className={buttonPrimary}>
          New guardrail
        </button>
      }
    />
  </div>
)

export const WithMeta = () => (
  <div className="bg-canvas p-6">
    <PageHeader
      title="support-triage-bot"
      description="Routes inbound tickets to the right queue and drafts a first reply."
      meta={<span className="font-mono">https://hub.acme.dev/a/support-triage-bot</span>}
      actions={
        <>
          <button type="button" className={buttonSecondary}>
            Edit
          </button>
          <button type="button" className={buttonPrimary}>
            Deploy
          </button>
        </>
      }
    />
  </div>
)

export const TitleOnly = () => (
  <div className="bg-canvas p-6">
    <PageHeader title="Agent details" />
  </div>
)
