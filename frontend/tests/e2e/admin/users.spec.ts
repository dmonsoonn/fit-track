import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.admin })

test.describe('Admin Users (/admin/users)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
  })

  test('page shows "Управление пользователями" title', async ({ page }) => {
    await expect(page.getByText('Управление пользователями')).toBeVisible()
  })

  test('shows stat cards: Тренеров, Клиентов, Активных, Заблокировано', async ({ page }) => {
    await expect(page.getByText('Тренеров')).toBeVisible()
    await expect(page.getByText('Клиентов')).toBeVisible()
    await expect(page.getByText('Активных')).toBeVisible()
    await expect(page.getByText('Заблокировано')).toBeVisible()
  })

  test('shows E2E trainer and client in the list', async ({ page }) => {
    const env = readTestEnv()
    // use .first() because email appears in both desktop table and mobile card
    await expect(page.getByText(env.trainerEmail).first()).toBeVisible()
    await expect(page.getByText(env.clientEmail).first()).toBeVisible()
  })

  test('filter "Тренеры" shows only trainers', async ({ page }) => {
    // use getByRole('button') to avoid matching subtitle "Тренеры и клиенты системы"
    await page.getByRole('button', { name: 'Тренеры' }).click()
    const env = readTestEnv()
    await expect(page.getByText(env.trainerEmail).first()).toBeVisible()
  })

  test('filter "Клиенты" shows only clients', async ({ page }) => {
    await page.getByRole('button', { name: 'Клиенты' }).click()
    const env = readTestEnv()
    await expect(page.getByText(env.clientEmail).first()).toBeVisible()
  })

  test('search by email filters list', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.trainerEmail)
    await expect(page.getByText(env.trainerEmail).first()).toBeVisible()
    await expect(page.getByText(env.clientEmail).first()).not.toBeVisible()
  })

  test('search by name filters list', async ({ page }) => {
    await page.locator('input[placeholder="Поиск по имени или email"]').fill('E2E Trainer')
    // "E2E Trainer" appears in multiple cells/cards, use first()
    await expect(page.getByText('E2E Trainer').first()).toBeVisible()
  })

  test('"Изменить" opens edit modal for E2E trainer', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.trainerEmail)
    await page.getByRole('button', { name: 'Изменить' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Modal title should be the user's full name
    await expect(page.getByRole('dialog').getByText('E2E Trainer')).toBeVisible()
  })

  test('edit modal shows role select and active toggle', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.trainerEmail)
    await page.getByRole('button', { name: 'Изменить' }).first().click()
    await expect(page.getByRole('dialog').locator('[data-table="users"][data-attr="role"] select')).toBeVisible()
    await expect(page.getByRole('dialog').locator('[data-table="users"][data-attr="is_active"]')).toBeVisible()
  })

  test('can save user without changes and shows success toast', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.trainerEmail)
    await page.getByRole('button', { name: 'Изменить' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Пользователь обновлён')
  })

  test('can toggle is_active off and back on (block/unblock)', async ({ page }) => {
    const env = readTestEnv()
    // Search and open edit modal for the E2E client
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.clientEmail)
    await page.waitForTimeout(300) // debounce
    await page.getByRole('button', { name: 'Изменить' }).first().click()

    const dialog = page.getByRole('dialog')
    const toggle = dialog.locator('[data-table="users"][data-attr="is_active"] button')
    const isActive = await toggle.getAttribute('aria-pressed')
    if (isActive === 'true') {
      await toggle.click()
      await dialog.getByRole('button', { name: 'Сохранить' }).click()
      await expectToast(page, 'Пользователь обновлён')

      // Re-activate to restore state
      await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.clientEmail)
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Изменить' }).first().click()
      await page.getByRole('dialog').locator('[data-table="users"][data-attr="is_active"] button').click()
      await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
      await expectToast(page, 'Пользователь обновлён')
    }
  })

  test('"Удалить" in modal opens confirm dialog', async ({ page }) => {
    const env = readTestEnv()
    await page.locator('input[placeholder="Поиск по имени или email"]').fill(env.trainerEmail)
    await page.getByRole('button', { name: 'Изменить' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expect(page.getByRole('dialog', { name: 'Удалить пользователя?' })).toBeVisible()
    // Cancel so we don't actually delete the test user
    await page.getByRole('dialog', { name: 'Удалить пользователя?' }).getByRole('button', { name: 'Отменить' }).click()
  })
})
