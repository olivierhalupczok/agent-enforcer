import { AuthContext, MemoryRouter, ModeContext, RoleContext, Sidebar } from 'web'

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

function Shell({ mode, role, path }: { mode: 'panel' | 'agent'; role: 'admin' | 'dev' | 'tester'; path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthContext value={auth}>
        <RoleContext value={{ role, setRole: noop }}>
          <ModeContext value={{ mode, setMode: noop }}>
            <div className="h-[760px]">
              <Sidebar id="preview-sidebar" open onNavigate={noop} counts={{ '/sessions': 3 }} />
            </div>
          </ModeContext>
        </RoleContext>
      </AuthContext>
    </MemoryRouter>
  )
}

export const AgentWrapped = () => <Shell mode="panel" role="admin" path="/sessions" />
export const AgentIntegrated = () => <Shell mode="agent" role="admin" path="/playground" />
export const TesterRole = () => <Shell mode="panel" role="tester" path="/test" />
