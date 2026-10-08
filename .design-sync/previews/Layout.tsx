import {
  AuthContext,
  EmptyState,
  Layout,
  LoadingRows,
  MemoryRouter,
  ModeContext,
  PageHeader,
  PageShell,
  RoleContext,
  Route,
  Routes,
  TableFrame,
  buttonPrimary,
} from 'web'
import type { ReactNode } from 'react'

const noop = () => {}
const auth = {
  status: 'ready' as const,
  session: { accessToken: '', email: 'maria.kowalska@acme.dev', anonymous: false },
  configured: true,
  notice: null,
  signIn: async () => null,
  signOut: async () => {},
  watchTables: null,
}

function App({ path, page }: { path: string; page: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthContext value={auth}>
        <RoleContext value={{ role: 'admin', setRole: noop }}>
          <ModeContext value={{ mode: 'panel', setMode: noop }}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="*" element={page} />
              </Route>
            </Routes>
          </ModeContext>
        </RoleContext>
      </AuthContext>
    </MemoryRouter>
  )
}

const cell = 'px-5 py-4 align-middle'
const AGENTS = [
  ['support-triage-bot', 'Routes inbound tickets to the right queue.', 'https://triage.internal.acme.dev'],
  ['invoice-reader', 'Extracts totals and due dates from PDFs.', 'https://invoices.internal.acme.dev'],
  ['sales-research', 'Summarises accounts before a call.', 'https://research.internal.acme.dev'],
]

export const AgentsPage = () => (
  <App
    path="/agents"
    page={
      <PageShell>
        <PageHeader
          title="Agents"
          description="Proxy agents sit behind a guarded URL. Register one by its upstream URL; the hub checks it answers before saving."
          actions={
            <button type="button" className={buttonPrimary}>
              Register agent
            </button>
          }
        />
        <TableFrame label="Agents table">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[#F9F9F6]">
              <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
                {['Agent', 'Description', 'Agent URL'].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENTS.map(([name, description, url]) => (
                <tr key={name} className="border-b border-line last:border-b-0">
                  <td className={`${cell} font-semibold`}>{name}</td>
                  <td className={`${cell} text-muted`}>{description}</td>
                  <td className={`${cell} font-mono text-[13px] text-muted`}>{url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </PageShell>
    }
  />
)

export const EmptyPage = () => (
  <App
    path="/guardrails"
    page={
      <PageShell>
        <PageHeader title="Guardrails" description="Single checks on text going to or from a proxy agent." />
        <EmptyState title="No guardrails yet" description="Create a guardrail to check text going to or from a proxy agent." />
      </PageShell>
    }
  />
)

export const LoadingPage = () => (
  <App
    path="/audit"
    page={
      <PageShell>
        <PageHeader title="Audit log" />
        <LoadingRows label="Loading audit events" count={4} />
      </PageShell>
    }
  />
)
