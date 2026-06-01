import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.trainer })

test.describe('Trainer Profile (/trainer/profile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trainer/profile')
    await page.waitForLoadState('networkidle')
  })

  test('displays trainer email in subtitle', async ({ page }) => {
    const env = readTestEnv()
    await expect(page.getByText(env.trainerEmail)).toBeVisible()
  })

  test('first_name and last_name fields are read-only (disabled)', async ({ page }) => {
    await expect(page.locator('[data-table="users"][data-attr="first_name"] input')).toBeDisabled()
    await expect(page.locator('[data-table="users"][data-attr="last_name"] input')).toBeDisabled()
  })

  test('invite code is shown in the invite_code field', async ({ page }) => {
    const env = readTestEnv()
    await expect(
      page.locator('[data-table="trainers"][data-attr="invite_code"] input'),
    ).toHaveValue(env.inviteCode)
  })

  test('Копировать button shows "Код скопирован" toast', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Копировать' }).click()
    await expectToast(page, 'Код скопирован')
  })

  test('saves updated specialization and shows success toast', async ({ page }) => {
    const specInput = page.locator('[data-table="trainers"][data-attr="specialization"] input')
    await specInput.clear()
    await specInput.fill('Силовые тренировки')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Профиль сохранён')
  })

  test('shows unsaved-changes dialog when navigating away with dirty form', async ({ page }) => {
    const specInput = page.locator('[data-table="trainers"][data-attr="specialization"] input')
    await specInput.clear()
    await specInput.fill('Dirty Value')
    await page.getByRole('link', { name: 'Клиенты' }).click()
    await expect(page.getByRole('dialog', { name: 'Несохранённые изменения' })).toBeVisible()
  })
})
