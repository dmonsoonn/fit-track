import path from 'node:path'
import fs from 'node:fs'

export const API_BASE = 'http://localhost:8080/api/v1'

export const ADMIN_EMAIL = 'admin@fittrack.local'
export const ADMIN_PASSWORD = 'admin1234'

const AUTH_DIR = path.join('tests', 'fixtures', '.auth')

export const STORAGE_STATES = {
  admin:   path.join(AUTH_DIR, 'admin.json'),
  trainer: path.join(AUTH_DIR, 'trainer.json'),
  client:  path.join(AUTH_DIR, 'client.json'),
} as const

export interface TestEnv {
  trainerEmail: string
  trainerToken: string
  trainerId: number
  clientEmail: string
  clientToken: string
  clientId: number
  adminToken: string
  inviteCode: string
  pw: string
  stamp: number
}

export function readTestEnv(): TestEnv {
  const p = path.resolve(path.join(AUTH_DIR, 'test-env.json'))
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as TestEnv
}

export function ensureAuthDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
}

async function request(method: string, apiPath: string, body?: object, token?: string) {
  const res = await fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json() as { data: unknown; error: string | null }
  if (json.error) throw new Error(`${method} ${apiPath} → ${json.error}`)
  return json.data
}

export const apiPost  = (p: string, b: object, t?: string) => request('POST', p, b, t)
export const apiGet   = (p: string, t: string) => request('GET', p, undefined, t)
export const apiPatch = (p: string, b: object, t: string) => request('PATCH', p, b, t)
export const apiDelete = (p: string, t: string) => request('DELETE', p, undefined, t)
