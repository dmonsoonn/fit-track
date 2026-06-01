import { test, expect } from 'playwright/test'
import { readTestEnv } from '../../fixtures/auth'
import { uniqueSuffix } from '../../fixtures/data'

test.describe('Registration page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('shows Клиент role chip selected by default', async ({ page }) => {
    // invite_code field should be visible by default (client role is default)
    await expect(page.locator('[data-table="trainers"][data-attr="invite_code"]')).toBeVisible()
  })

  test('invite code field hidden when Тренер chip is clicked', async ({ page }) => {
    await page.locator('[data-table="users"][data-attr="role"]').getByText('Тренер').click()
    await expect(page.locator('[data-table="trainers"][data-attr="invite_code"]')).not.toBeVisible()
  })

  test('invite code field appears when Клиент chip is clicked', async ({ page }) => {
    await page.locator('[data-table="users"][data-attr="role"]').getByText('Тренер').click()
    await page.locator('[data-table="users"][data-attr="role"]').getByText('Клиент').click()
    await expect(page.locator('[data-table="trainers"][data-attr="invite_code"]')).toBeVisible()
  })

  test('registers a trainer with valid data and redirects to /trainer/profile', async ({ page }) => {
    const suffix = uniqueSuffix()
    await page.locator('[data-table="users"][data-attr="role"]').getByText('Тренер').click()
    await page.locator('[data-table="users"][data-attr="first_name"] input').fill('Test')
    await page.locator('[data-table="users"][data-attr="last_name"] input').fill('Trainer')
    await page.locator('[data-table="users"][data-attr="email"] input').fill(`reg.trainer.${suffix}@test.local`)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('Test1234!')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.waitForURL('**/trainer/profile', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/trainer\/profile/)
  })

  test('registers a client with valid invite code and redirects to /profile', async ({ page }) => {
    const env = readTestEnv()
    const suffix = uniqueSuffix()
    await page.locator('[data-table="users"][data-attr="first_name"] input').fill('Test')
    await page.locator('[data-table="users"][data-attr="last_name"] input').fill('Client')
    await page.locator('[data-table="users"][data-attr="email"] input').fill(`reg.client.${suffix}@test.local`)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('Test1234!')
    await page.locator('[data-table="trainers"][data-attr="invite_code"] input').fill(env.inviteCode)
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.waitForURL('**/profile', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('shows error message for invalid invite code', async ({ page }) => {
    const suffix = uniqueSuffix()
    await page.locator('[data-table="users"][data-attr="first_name"] input').fill('Test')
    await page.locator('[data-table="users"][data-attr="last_name"] input').fill('Client')
    await page.locator('[data-table="users"][data-attr="email"] input').fill(`bad.invite.${suffix}@test.local`)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('Test1234!')
    await page.locator('[data-table="trainers"][data-attr="invite_code"] input').fill('INVALID_CODE_XYZ')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await expect(page.locator('.bg-danger-bg')).toBeVisible({ timeout: 5_000 })
  })

  test('shows error message for duplicate email', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('[data-table="users"][data-attr="role"]').getByText('Тренер').click()
    await page.locator('[data-table="users"][data-attr="first_name"] input').fill('Test')
    await page.locator('[data-table="users"][data-attr="last_name"] input').fill('Trainer')
    await page.locator('[data-table="users"][data-attr="email"] input').fill(env.trainerEmail)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('Test1234!')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await expect(page.locator('.bg-danger-bg')).toBeVisible({ timeout: 5_000 })
  })

  test('has a link to the login page', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible()
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
