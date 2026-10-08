import { LiveBadge, PageHeader } from 'web'

export const Default = () => (
  <div className="bg-canvas p-6">
    <LiveBadge />
  </div>
)

export const InPageHeader = () => (
  <div className="bg-canvas p-6">
    <PageHeader
      title="Audit log"
      description="Every request a proxy agent handled, with the guardrail verdicts it got."
      actions={<LiveBadge />}
    />
  </div>
)
