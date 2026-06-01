import axios, { AxiosError } from 'axios'
import type { ApiEnvelope } from '@/types'
import { getToken, useAuthStore } from '@/store/auth'
import { queryClient } from '@/lib/queryClient'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export const http = axios.create({ baseURL })

// Attach the bearer token to every request.
http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 → clear session and bounce to /login.
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    if (error.response?.status === 401) {
      const { logout } = useAuthStore.getState()
      logout()
      queryClient.clear()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

/** Extract a human-readable message from an axios/API error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiEnvelope<unknown> | undefined
    if (data?.error) return data.error
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Произошла ошибка'
}

/** Unwrap the `{ data, error }` envelope, returning `data`. */
export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const res = await promise
  if (res.data.error) throw new Error(res.data.error)
  return res.data.data as T
}
