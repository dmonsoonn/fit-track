import { test, expect } from 'playwright/test'
import { readTestEnv } from '../../fixtures/auth'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('logs in as trainer and redirects to /trainer/profile', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('[data-table="users"][data-attr="email"] input').fill(env.trainerEmail)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill(env.pw)
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL('**/trainer/profile', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/trainer\/profile/)
  })

  test('logs in as client and redirects to /profile', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('[data-table="users"][data-attr="email"] input').fill(env.clientEmail)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill(env.pw)
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL('**/profile', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('shows error message for wrong password', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('[data-table="users"][data-attr="email"] input').fill(env.trainerEmail)
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('WrongPass999!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.locator('.bg-danger-bg')).toBeVisible({ timeout: 5_000 })
  })

  test('shows error message for non-existent email', async ({ page }) => {
    await page.locator('[data-table="users"][data-attr="email"] input').fill('nobody@nonexistent.local')
    await page.locator('[data-table="users"][data-attr="password_hash"] input').fill('Test1234!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.locator('.bg-danger-bg')).toBeVisible({ timeout: 5_000 })
  })

  test('has a link to the register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Зарегистрироваться' })).toBeVisible()
    await page.getByRole('link', { name: 'Зарегистрироваться' }).click()
    await expect(page).toHaveURL(/\/register/)
  })
})
