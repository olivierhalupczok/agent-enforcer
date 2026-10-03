import { Navigate, Route, Routes } from 'react-router'
import { Placeholder } from '../pages/Placeholder'
import { Layout } from './Layout'
import { homeFor, navItemsFor } from './nav'
import { useRole } from './role'

export function AppRoutes() {
  const { role } = useRole()

  return (
    <Routes>
      <Route element={<Layout />}>
        {navItemsFor(role).map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={<Placeholder title={item.title} issue={item.issue} />}
          />
        ))}
        {role !== 'tester' && (
          <Route path="/agents/:agentId" element={<Placeholder title="Agent" issue="D-03 / D-04" />} />
        )}
        <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
      </Route>
    </Routes>
  )
}
