import { EmptyState, LiveBadge, PageHeader, PageShell, buttonPrimary, buttonSecondary } from 'web'

export const PageWithHeader = () => (
  <div className="bg-canvas p-6">
    <PageShell>
      <PageHeader
        title="MCP servers"
        description="Registered tool servers and configured tool allowlists. Credentials are stored by the hub and never shown again."
        actions={
          <button type="button" className={buttonPrimary}>
            Register MCP server
          </button>
        }
      />
      <EmptyState
        title="No MCP servers registered yet."
        description="Record a tool server and the exact tool names allowed on it."
      />
    </PageShell>
  </div>
)

export const WithCards = () => (
  <div className="bg-canvas p-6">
    <PageShell>
      <PageHeader title="Security scan" description="Scorecards for every deployed agent." actions={<LiveBadge />} />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Prompt injection', '12 blocked', 'bg-teal-soft text-teal-dark'],
          ['PII leaks', '2 flagged', 'bg-warn-bg text-warn-fg'],
          ['Tool misuse', '0 incidents', 'bg-teal-soft text-teal-dark'],
        ].map(([title, value, tone]) => (
          <section key={title} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 className="m-0 text-sm font-semibold text-muted">{title}</h2>
            <span className={`inline-flex w-fit rounded-md px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{value}</span>
          </section>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className={buttonSecondary}>
          Export report
        </button>
      </div>
    </PageShell>
  </div>
)
