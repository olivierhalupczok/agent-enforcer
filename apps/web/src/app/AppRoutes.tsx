import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { AgentPage } from '../pages/agent/AgentPage'
import { AgentsPage } from '../pages/agents/AgentsPage'
import { RegisterAgentPage } from '../pages/agents/RegisterAgentPage'
import { AuditLogPage } from '../pages/audit/AuditLogPage'
import { GuardrailsPage } from '../pages/guardrails/GuardrailsPage'
import { McpServersPage } from '../pages/mcp/McpServersPage'
import { SecurityPage } from '../pages/security/SecurityPage'
import { SessionsPage } from '../pages/sessions/SessionsPage'
import { SignInPage } from '../pages/SignInPage'
import { TestChatPage } from '../pages/test/TestChatPage'
import { Layout } from './Layout'
import { homeFor, navItemsFor } from './nav'
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
}

export function AppRoutes() {
  const { role } = useRole()

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
        {navItemsFor(role).map((item) => (
          <Route key={item.path} path={item.path} element={PAGES[item.path]} />
        ))}
        {role !== 'tester' && (
          <>
            <Route path="/agents/new" element={<RegisterAgentPage />} />
            {/* Not in the nav (agents are tested from their workspace), but deep links keep working. */}
            <Route path="/test" element={<TestChatPage />} />
            <Route path="/agents/:agentId/:section?" element={<AgentPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
      </Route>
    </Routes>
  )
}
