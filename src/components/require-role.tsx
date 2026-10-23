import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/components/auth-provider'
import type { Role } from '@/lib/mock-data'

export default function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="sr-only">Checking your session</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.some((role) => user.roles.includes(role))) {
    return <Navigate to={user.roles.includes('voter') ? '/dashboard' : '/'} replace />
  }
  return <Outlet />
}
