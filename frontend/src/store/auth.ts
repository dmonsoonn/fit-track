import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/types'
import { decodeJwt, isExpired } from '@/lib/jwt'

interface AuthState {
  token: string | null
  userId: number | null
  role: Role | null
  /** Cached display name (filled after profile fetch). */
  displayName: string | null
  unreadCount: number
  setSession: (token: string) => void
  setDisplayName: (name: string) => void
  setUnreadCount: (n: number) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userId: null,
      role: null,
      displayName: null,
      unreadCount: 0,
      setSession: (token) => {
        const payload = decodeJwt(token)
        if (!payload) {
          set({ token: null, userId: null, role: null })
          return
        }
        set({ token, userId: payload.user_id, role: payload.role })
      },
      setDisplayName: (displayName) => set({ displayName }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      logout: () =>
        set({ token: null, userId: null, role: null, displayName: null, unreadCount: 0 }),
      isAuthenticated: () => {
        const { token } = get()
        if (!token) return false
        return !isExpired(decodeJwt(token))
      },
    }),
    {
      name: 'fittrack-auth',
      partialize: (s) => ({
        token: s.token,
        userId: s.userId,
        role: s.role,
        displayName: s.displayName,
      }),
    },
  ),
)

/** Read the current token outside React (for the axios interceptor). */
export function getToken(): string | null {
  return useAuthStore.getState().token
}
