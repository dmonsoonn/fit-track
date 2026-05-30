import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/auth'
import { NAV_BY_ROLE } from '@/lib/nav'

/** Fixed bottom tab bar — mobile only (hidden on lg). */
export function BottomNav() {
  const role = useAuthStore((s) => s.role)
  const unread = useAuthStore((s) => s.unreadCount)
  if (!role) return null
  const items = NAV_BY_ROLE[role]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-content">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badge && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
