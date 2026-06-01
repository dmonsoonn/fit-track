import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, Dumbbell, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/auth'
import { NAV_BY_ROLE } from '@/lib/nav'
import { ConfirmDialog } from '@/components/ui'
import { queryClient } from '@/lib/queryClient'

const ROLE_LABEL: Record<string, string> = { admin: 'ADMIN', trainer: 'ТРЕНЕР', client: 'КЛИЕНТ' }

export function Header() {
  const role = useAuthStore((s) => s.role)
  const unread = useAuthStore((s) => s.unreadCount)
  const displayName = useAuthStore((s) => s.displayName)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)
  if (!role) return null

  // Separate notification item (badge=true) from regular nav items
  const allItems = NAV_BY_ROLE[role]
  const navItems = allItems.filter((i) => !i.badge)
  const notifItem = allItems.find((i) => i.badge)

  const onLogout = () => {
    logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card">
      <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
            <Dumbbell className="h-4 w-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">FitTrack</span>
        </div>

        {/* Desktop nav — regular items only */}
        <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'rounded-btn px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-50 text-primary' : 'text-muted hover:bg-page',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {displayName && (
            <span className="hidden text-sm text-muted sm:inline">{displayName}</span>
          )}
          <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
            {ROLE_LABEL[role]}
          </span>

          {/* Bell icon for notifications */}
          {notifItem && (
            <NavLink
              to={notifItem.to}
              className={({ isActive }) =>
                cn(
                  'relative rounded-btn p-2 transition-colors',
                  isActive ? 'bg-primary-50 text-primary' : 'text-muted hover:bg-page',
                )
              }
              title="Уведомления"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
          )}

          <button
            onClick={() => setLogoutOpen(true)}
            className="flex items-center gap-1 rounded-btn px-2 py-1.5 text-sm text-muted hover:bg-page hover:text-danger"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={onLogout}
        title="Выйти из аккаунта?"
        confirmLabel="Выйти"
      />
    </header>
  )
}
