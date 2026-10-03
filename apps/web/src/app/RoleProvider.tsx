import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { RoleContext, readStoredRole, storeRole, type Role } from './role'

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole)

  const setRole = useCallback((next: Role) => {
    setRoleState(next)
    storeRole(next)
  }, [])

  const value = useMemo(() => ({ role, setRole }), [role, setRole])

  return <RoleContext value={value}>{children}</RoleContext>
}
