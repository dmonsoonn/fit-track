import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { notificationApi, clientApi, trainerApi } from '@/api'
import { useAuthStore } from '@/store/auth'

/** Authenticated layout: header + content + mobile bottom nav. Polls unread count + display name. */
export function AppShell() {
  const role = useAuthStore((s) => s.role)
  const setUnreadCount = useAuthStore((s) => s.setUnreadCount)
  const setDisplayName = useAuthStore((s) => s.setDisplayName)
  const displayName = useAuthStore((s) => s.displayName)

  // Notification badge (admins have no notifications endpoint usage in nav).
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    refetchInterval: 10_000,
    enabled: role === 'client' || role === 'trainer',
  })

  useEffect(() => {
    if (notifications) {
      setUnreadCount(notifications.filter((n) => !n.is_read).length)
    }
  }, [notifications, setUnreadCount])

  // Resolve a display name once (no /auth/me endpoint).
  const { data: profileName } = useQuery({
    queryKey: ['display-profile', role],
    queryFn: async (): Promise<string> => {
      const p = role === 'client' ? await clientApi.me() : await trainerApi.me()
      return `${p.first_name} ${p.last_name}`
    },
    enabled: (role === 'client' || role === 'trainer') && !displayName,
  })

  useEffect(() => {
    if (profileName) setDisplayName(profileName)
  }, [profileName, setDisplayName])

  return (
    <div className="min-h-screen bg-page">
      <Header />
      <main className="mx-auto max-w-content px-4 pb-24 pt-4 sm:px-6 lg:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
