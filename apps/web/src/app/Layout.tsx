import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-canvas text-ink md:flex">
      <Sidebar id="app-sidebar" open={false} onNavigate={() => {}} />
      <main className="min-w-0 flex-1 px-[clamp(16px,4vw,40px)] pt-8 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
