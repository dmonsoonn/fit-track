import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.client })

test.describe('Client Profile (/profile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
  })

  test('page loads and displays client email in subtitle', async ({ page }) => {
    const env = readTestEnv()
    await expect(page.getByText(env.clientEmail)).toBeVisible()
  })

  test('shows trainer name banner', async ({ page }) => {
    // E2E client is linked to E2E trainer, so trainer banner should appear
    await expect(page.getByText('Ваш тренер:')).toBeVisible()
  })

  test('saves updated first_name and shows success toast', async ({ page }) => {
    const firstNameInput = page.locator('[data-table="users"][data-attr="first_name"] input')
    await firstNameInput.clear()
    await firstNameInput.fill('UpdatedName')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Профиль сохранён')
  })

  test('fitness level Chip selection changes', async ({ page }) => {
    // LEVEL_LABEL uses 'Начальный', 'Средний', 'Продвинутый'
    await page.getByRole('button', { name: 'Начальный' }).click()
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Профиль сохранён')
  })

  test('saves weight and height as numeric values', async ({ page }) => {
    await page.locator('[data-table="clients"][data-attr="weight"] input').clear()
    await page.locator('[data-table="clients"][data-attr="weight"] input').fill('75')
    await page.locator('[data-table="clients"][data-attr="height"] input').clear()
    await page.locator('[data-table="clients"][data-attr="height"] input').fill('180')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Профиль сохранён')
  })

  test('Отменить button reverts form changes', async ({ page }) => {
    const firstNameInput = page.locator('[data-table="users"][data-attr="first_name"] input')
    const original = await firstNameInput.inputValue()
    await firstNameInput.clear()
    await firstNameInput.fill('TempName')
    await page.getByRole('button', { name: 'Отменить' }).click()
    await expect(firstNameInput).toHaveValue(original)
  })

  test('shows unsaved-changes dialog when navigating away with dirty form', async ({ page }) => {
    const firstNameInput = page.locator('[data-table="users"][data-attr="first_name"] input')
    await firstNameInput.clear()
    await firstNameInput.fill('DirtyName')
    // Navigate away via nav link
    await page.getByRole('link', { name: 'Расписание' }).click()
    await expect(page.getByRole('dialog', { name: 'Несохранённые изменения' })).toBeVisible()
  })

  test('confirm unsaved dialog navigates away', async ({ page }) => {
    const firstNameInput = page.locator('[data-table="users"][data-attr="first_name"] input')
    await firstNameInput.clear()
    await firstNameInput.fill('DirtyName')
    await page.getByRole('link', { name: 'Расписание' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Уйти' }).click()
    await expect(page).toHaveURL(/\/schedule/)
  })
})
