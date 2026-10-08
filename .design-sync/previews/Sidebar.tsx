import { AuthContext, MemoryRouter, RoleContext, Sidebar } from 'web'

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

function Shell({ role, path }: { role: 'admin' | 'dev' | 'tester'; path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthContext value={auth}>
        <RoleContext value={{ role, setRole: noop }}>
          <div className="h-[760px]">
            <Sidebar id="preview-sidebar" open onNavigate={noop} counts={{ '/audit': 3 }} />
          </div>
        </RoleContext>
      </AuthContext>
    </MemoryRouter>
  )
}

export const AdminNav = () => <Shell role="admin" path="/agents" />
export const TesterRole = () => <Shell role="tester" path="/test" />
