import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AgentPage } from '../pages/agent/AgentPage'
import { AgentsPage } from '../pages/agents/AgentsPage'
import { AuditLogPage } from '../pages/audit/AuditLogPage'
import { GuardrailsPage } from '../pages/guardrails/GuardrailsPage'
import { McpServersPage } from '../pages/mcp/McpServersPage'
import { PolicyPage } from '../pages/policy/PolicyPage'
import { PlaygroundPage } from '../pages/playground/PlaygroundPage'
import { SecurityPage } from '../pages/security/SecurityPage'
import { IncidentsPage } from '../pages/incidents/IncidentsPage'
import { SessionsPage } from '../pages/sessions/SessionsPage'
import { PiSessionsPage } from '../pages/piSessions/PiSessionsPage'
import { SignInPage } from '../pages/SignInPage'
import { TestChatPage } from '../pages/test/TestChatPage'
import { Layout } from './Layout'
import { AGENT_HOME, homeFor, navItemsFor } from './nav'
import { useMode } from './mode'
import { useRole } from './role'

// Every navigation item maps to a shipped screen.
const PAGES: Record<string, ReactElement> = {
  '/agents': <AgentsPage />,
  '/audit': <AuditLogPage />,
  '/guardrails': <GuardrailsPage />,
  '/mcp': <McpServersPage />,
  '/sessions': <SessionsPage />,
  '/test': <TestChatPage />,
  '/security': <SecurityPage />,
  '/policies': <PolicyPage />,
  '/playground': <PlaygroundPage />,
  '/incidents': <IncidentsPage />,
  '/pi-sessions': <PiSessionsPage />,
}

export function AppRoutes() {
  const { role } = useRole()
  const { mode } = useMode()

  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {navItemsFor(role, mode).map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={PAGES[item.path]}
          />
        ))}
        {mode === 'agent' ? (
          // agent mode only exposes the pi pages; deep links into panel pages redirect back
          <Route path="*" element={<Navigate to={AGENT_HOME} replace />} />
        ) : (
          <>
            {role !== 'tester' && <Route path="/agents/:agentId" element={<AgentPage />} />}
            {/* /playground works in panel mode too: the page itself is
                mode-agnostic, so deep links land on it without a mode switch */}
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="*" element={<Navigate to={homeFor(role, mode)} replace />} />
          </>
        )}
      </Route>
    </Routes>
  )
}
