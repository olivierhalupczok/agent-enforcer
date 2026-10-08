import { Brand } from 'web'

export const OnSidebar = () => (
  <div className="on-dark w-60 bg-sidebar px-4 py-6">
    <Brand subtitle="Agent Wrapped" />
  </div>
)

export const DefaultSubtitle = () => (
  <div className="on-dark w-60 bg-sidebar px-4 py-6">
    <Brand />
  </div>
)

export const MobileHeader = () => (
  <header className="on-dark flex h-14 w-full items-center justify-between bg-sidebar px-2">
    <Brand />
    <button type="button" className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-sidebar-muted">
      Menu
    </button>
  </header>
)
