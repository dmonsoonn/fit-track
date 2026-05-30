import type { Role } from '@/types'

export interface JwtPayload {
  user_id: number
  role: Role
  exp: number
}

/** Decode a JWT payload without verifying the signature (client-side display only). */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(
      decodeURIComponent(
        json
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    )
    if (typeof payload.user_id !== 'number' || typeof payload.role !== 'string') return null
    return payload as JwtPayload
  } catch {
    return null
  }
}

export function isExpired(payload: JwtPayload | null): boolean {
  if (!payload) return true
  return payload.exp * 1000 <= Date.now()
}
