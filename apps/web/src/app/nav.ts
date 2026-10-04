import type { Role } from './role'
import type { Mode } from './mode'

export interface NavItem {
  path: string
  label: string
  title: string
}

// Agent Wrapped (panel) mode: the control room pages.
// Note: /policies lives only in agent mode; there is a redirect for stray deep links.
export const PANEL_NAV_ITEMS: readonly NavItem[] = [
  { path: '/sessions', label: 'Sessions', title: 'Sessions' },
  { path: '/agents', label: 'Agents', title: 'Agents' },
  { path: '/guardrails', label: 'Guardrails', title: 'Guardrails' },
  { path: '/audit', label: 'Audit log', title: 'Audit log' },
  { path: '/mcp', label: 'MCP servers', title: 'MCP servers' },
  { path: '/test', label: 'Test chat', title: 'Test chat' },
  { path: '/security', label: 'Security', title: 'Security scan' },
]

// Agent Integrated mode: the pi agent harness integration.
export const AGENT_NAV_ITEMS: readonly NavItem[] = [
  { path: '/playground', label: 'Playground', title: 'Playground' },
  { path: '/policies', label: 'Policies', title: 'Policies' },
  { path: '/incidents', label: 'Incidents', title: 'Incidents' },
]

export const TESTER_HOME = '/test'
export const DEFAULT_HOME = '/sessions'
export const AGENT_HOME = '/playground'

export function homeFor(role: Role, mode: Mode): string {
  if (mode === 'agent') return AGENT_HOME
  return role === 'tester' ? TESTER_HOME : DEFAULT_HOME
}

export function navItemsFor(role: Role, mode: Mode): readonly NavItem[] {
  if (mode === 'agent') return AGENT_NAV_ITEMS
  return role === 'tester' ? PANEL_NAV_ITEMS.filter((item) => item.path === TESTER_HOME) : PANEL_NAV_ITEMS
}
