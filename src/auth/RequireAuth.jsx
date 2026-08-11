import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

/**
 * Additionally requires that a child has been picked, so a grade is pinned.
 * Staff are exempt: they have no child, and their scope is every grade.
 */
export function RequireStudent({ children }) {
  const { isAuthenticated, isAdmin, activeStudent } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin && !activeStudent) return <Navigate to="/children" replace />
  return children
}
