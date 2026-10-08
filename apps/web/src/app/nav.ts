import type { Role } from './role'

export interface NavItem {
  path: string
  label: string
  title: string
  // the sidebar starts a labelled group at the first item of each section
  section?: string
}

// Agents first, then the shared library each agent picks from, then cross-agent monitoring.
// Testing an agent lives in its own workspace (/agents/:id/test).
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/agents', label: 'Agents', title: 'Agents' },
  { path: '/guardrails', label: 'Guardrails', title: 'Guardrails', section: 'Library' },
  { path: '/mcp', label: 'MCP servers', title: 'MCP servers', section: 'Library' },
  { path: '/sessions', label: 'Sessions', title: 'Sessions', section: 'Monitor' },
  { path: '/audit', label: 'Audit log', title: 'Audit log', section: 'Monitor' },
  { path: '/security', label: 'Security', title: 'Security scan', section: 'Monitor' },
]

// Testers only send test messages, so their whole app is the test chat.
export const TESTER_NAV_ITEMS: readonly NavItem[] = [
  { path: '/test', label: 'Test chat', title: 'Test chat' },
]

export const TESTER_HOME = '/test'
export const DEFAULT_HOME = '/agents'

export function homeFor(role: Role): string {
  return role === 'tester' ? TESTER_HOME : DEFAULT_HOME
}

export function navItemsFor(role: Role): readonly NavItem[] {
  return role === 'tester' ? TESTER_NAV_ITEMS : NAV_ITEMS
}
