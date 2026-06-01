import { test, expect } from 'playwright/test'
import { STORAGE_STATES } from '../../fixtures/auth'

test.describe('Role-based access control', () => {
  test.describe('Unauthenticated user', () => {
    test('visiting /profile redirects to /login', async ({ page }) => {
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /trainer/profile redirects to /login', async ({ page }) => {
      await page.goto('/trainer/profile')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /admin/users redirects to /login', async ({ page }) => {
      await page.goto('/admin/users')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Client cannot access trainer or admin routes', () => {
    test.use({ storageState: STORAGE_STATES.client })

    test('visiting /trainer/clients redirects to /profile', async ({ page }) => {
      await page.goto('/trainer/clients')
      await expect(page).toHaveURL(/\/profile$/)
    })

    test('visiting /trainer/profile redirects to /profile', async ({ page }) => {
      await page.goto('/trainer/profile')
      await expect(page).toHaveURL(/\/profile$/)
    })

    test('visiting /admin/users redirects to /profile', async ({ page }) => {
      await page.goto('/admin/users')
      await expect(page).toHaveURL(/\/profile$/)
    })
  })

  test.describe('Trainer cannot access client or admin routes', () => {
    test.use({ storageState: STORAGE_STATES.trainer })

    test('visiting /profile redirects to /trainer/profile', async ({ page }) => {
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/trainer\/profile/)
    })

    test('visiting /food-diary redirects to /trainer/profile', async ({ page }) => {
      await page.goto('/food-diary')
      await expect(page).toHaveURL(/\/trainer\/profile/)
    })

    test('visiting /admin/users redirects to /trainer/profile', async ({ page }) => {
      await page.goto('/admin/users')
      await expect(page).toHaveURL(/\/trainer\/profile/)
    })
  })
})
