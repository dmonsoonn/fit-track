import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { HOME_BY_ROLE } from '@/lib/nav'
import type { Role } from '@/types'

/** Requires a valid session; otherwise redirects to /login. */
export function PrivateRoute() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const location = useLocation()
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Restricts a branch to specific roles; wrong role redirects to its home. */
export function RoleRoute({ allow }: { allow: Role[] }) {
  const role = useAuthStore((s) => s.role)
  if (!role) return <Navigate to="/login" replace />
  if (!allow.includes(role)) return <Navigate to={HOME_BY_ROLE[role]} replace />
  return <Outlet />
}
