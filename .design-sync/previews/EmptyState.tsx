import { EmptyState, buttonPrimary } from 'web'

export const WithAction = () => (
  <div className="bg-canvas p-6">
    <EmptyState
      title="No agents yet. Register your first one."
      description="Add an A2A agent to create its guarded URL and begin applying guardrails."
      action={
        <button type="button" className={buttonPrimary}>
          Register agent
        </button>
      }
    />
  </div>
)

export const WithLink = () => (
  <div className="bg-canvas p-6">
    <EmptyState
      title="No incidents recorded"
      description={
        <>
          Run a <a href="#" className="font-medium">scenario on the Playground</a> to see blocked tool calls show up here.
        </>
      }
    />
  </div>
)

export const Plain = () => (
  <div className="bg-canvas p-6">
    <EmptyState title="No injection signatures" description="No company-wide signatures are configured." />
  </div>
)
