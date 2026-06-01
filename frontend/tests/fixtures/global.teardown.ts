import { readTestEnv, apiGet, apiDelete } from './auth'

export default async function globalTeardown() {
  let env: ReturnType<typeof readTestEnv>
  try {
    env = readTestEnv()
  } catch {
    // test-env.json not written (setup failed) — nothing to clean up
    return
  }

  const users = await apiGet('/admin/users', env.adminToken) as Array<{
    user_id: number
    email: string
  }>

  const trainerUser = users.find((u) => u.email === env.trainerEmail)
  const clientUser  = users.find((u) => u.email === env.clientEmail)

  // Delete CLIENT first so the FK constraint on clients.trainer_id is removed,
  // then delete TRAINER. Without this order, trainer deletion fails (no CASCADE on clients.trainer_id).
  if (clientUser) {
    await apiDelete(`/admin/users/${clientUser.user_id}`, env.adminToken).catch(() => {})
  }
  if (trainerUser) {
    await apiDelete(`/admin/users/${trainerUser.user_id}`, env.adminToken).catch(() => {})
  }
}
