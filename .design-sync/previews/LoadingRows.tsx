import { LoadingRows } from 'web'

export const Default = () => (
  <div className="bg-canvas p-6">
    <LoadingRows label="Loading MCP servers" />
  </div>
)

export const FourRows = () => (
  <div className="bg-canvas p-6">
    <LoadingRows label="Loading audit events" count={4} />
  </div>
)

export const Compact = () => (
  <div className="bg-canvas p-6">
    <LoadingRows label="Loading signatures" count={2} />
  </div>
)
