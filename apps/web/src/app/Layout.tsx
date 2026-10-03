import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { Brand } from './Brand'
import { Sidebar } from './Sidebar'

const SIDEBAR_ID = 'app-sidebar'

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  // Esc and backdrop close the drawer without moving anywhere, so put focus back on Menu
  const dismissMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    document.getElementById(SIDEBAR_ID)?.querySelector('a')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, dismissMenu])

  return (
    <div className="min-h-screen bg-canvas text-ink md:flex">
      <header className="on-dark sticky top-0 z-20 flex h-14 items-center justify-between bg-sidebar px-2 md:hidden">
        <Brand />
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={SIDEBAR_ID}
          onClick={() => setMenuOpen((open) => !open)}
          className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-sidebar-muted hover:bg-sidebar-active hover:text-white"
        >
          Menu
        </button>
      </header>
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={dismissMenu}
          className="fixed inset-0 z-30 cursor-default border-0 bg-black/40 md:hidden"
        />
      )}
      <Sidebar id={SIDEBAR_ID} open={menuOpen} onNavigate={closeMenu} />
      <main className="min-w-0 flex-1 px-[clamp(16px,4vw,40px)] pt-8 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
