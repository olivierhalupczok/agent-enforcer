import { render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AppRoutes } from '../app/AppRoutes'
import { ROLE_STORAGE_KEY, type Role } from '../app/role'
import { RoleProvider } from '../app/RoleProvider'

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

export function renderApp(path: string, role?: Role) {
  if (role) localStorage.setItem(ROLE_STORAGE_KEY, role)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RoleProvider>
        <AppRoutes />
        <LocationProbe />
      </RoleProvider>
    </MemoryRouter>,
  )
}
