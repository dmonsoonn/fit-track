import { test as setup, expect } from 'playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  API_BASE,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  STORAGE_STATES,
  ensureAuthDir,
  apiPost,
  apiGet,
} from './auth'
import type { TestEnv } from './auth'

const AUTH_DIR = path.join('tests', 'fixtures', '.auth')
const TEST_ENV_PATH = path.join(AUTH_DIR, 'test-env.json')

setup('global setup — create users and save storage states', async ({ browser }) => {
  ensureAuthDir()

  const stamp = Date.now()
  const pw = 'Test1234!'

  // ── 1. Admin login ────────────────────────────────────────────────────────
  const adminLogin = await apiPost('/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }) as { token: string }
  const adminToken = adminLogin.token
  expect(adminToken, 'Admin login failed — is the DB seeded? Run: go run ./cmd/seed').toBeTruthy()

  // ── 2. Register E2E trainer ───────────────────────────────────────────────
  const trainerEmail = `e2e.trainer.${stamp}@test.local`
  await apiPost('/auth/register', {
    email: trainerEmail,
    first_name: 'E2E',
    last_name: 'Trainer',
    password: pw,
    role: 'trainer',
  })
  const trainerLogin = await apiPost('/auth/login', {
    email: trainerEmail,
    password: pw,
  }) as { token: string }
  const trainerToken = trainerLogin.token

  const trainerProfile = await apiGet('/trainers/me', trainerToken) as {
    trainer_id: number
    invite_code: string
  }
  const inviteCode: string = trainerProfile.invite_code
  const trainerId: number = trainerProfile.trainer_id

  // ── 3. Register E2E client ────────────────────────────────────────────────
  const clientEmail = `e2e.client.${stamp}@test.local`
  await apiPost('/auth/register', {
    email: clientEmail,
    first_name: 'E2E',
    last_name: 'Client',
    password: pw,
    role: 'client',
    invite_code: inviteCode,
  })
  const clientLogin = await apiPost('/auth/login', {
    email: clientEmail,
    password: pw,
  }) as { token: string }
  const clientToken = clientLogin.token

  const clientProfile = await apiGet('/clients/me', clientToken) as { client_id: number }
  const clientId: number = clientProfile.client_id

  // ── 4. Write test-env.json ────────────────────────────────────────────────
  const testEnv: TestEnv = {
    trainerEmail,
    trainerToken,
    trainerId,
    clientEmail,
    clientToken,
    clientId,
    adminToken,
    inviteCode,
    pw,
    stamp,
  }
  fs.writeFileSync(TEST_ENV_PATH, JSON.stringify(testEnv, null, 2))

  // ── 5. Save browser storage states via real UI login ──────────────────────
  const loginCases: Array<{
    role: 'admin' | 'trainer' | 'client'
    email: string
    home: string
  }> = [
    { role: 'admin',   email: ADMIN_EMAIL,  home: '/admin/users' },
    { role: 'trainer', email: trainerEmail, home: '/trainer/profile' },
    { role: 'client',  email: clientEmail,  home: '/profile' },
  ]

  for (const { role, email, home } of loginCases) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto('http://localhost:5173/login')
    const password = role === 'admin' ? ADMIN_PASSWORD : pw
    await page.locator('[data-table="users"][data-attr="email"] input').fill(email)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill(password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL(`**${home}`, { timeout: 10_000 })

    await ctx.storageState({ path: STORAGE_STATES[role] })
    await ctx.close()
  }
})
