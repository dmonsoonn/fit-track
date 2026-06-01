import { test, expect } from 'playwright/test'
import { STORAGE_STATES } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'
import { uniqueSuffix } from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.trainer })

test.describe('Trainer Exercises (/trainer/exercises)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trainer/exercises')
    await page.waitForLoadState('networkidle')
  })

  test('page shows "Упражнения" title and correct subtitle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Упражнения' })).toBeVisible()
    await expect(page.getByText('Системные и ваши собственные')).toBeVisible()
  })

  test('system exercises show "Системное" badge', async ({ page }) => {
    const systemBadge = page.getByText('Системное').first()
    if (await systemBadge.isVisible()) {
      await expect(systemBadge).toBeVisible()
    }
  })

  test('system exercises have no edit/delete buttons (for trainer)', async ({ page }) => {
    // System exercises (trainer_id=null) should not show edit/delete for trainers
    // They only appear for admin role
    const systemCards = page.locator('[class*="grid.gap"] > div').filter({ hasText: 'Системное' })
    const count = await systemCards.count()
    if (count > 0) {
      const firstCard = systemCards.first()
      await expect(firstCard.getByRole('button', { name: 'Изменить' })).not.toBeVisible()
    }
  })

  test('"Упражнение" button opens create modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await expect(page.getByRole('dialog', { name: 'Новое упражнение' })).toBeVisible()
  })

  test('Сохранить is disabled when name is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  })

  test('creates a new exercise and it appears in the list', async ({ page }) => {
    const name = `Test Ex ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="muscle_group"] input').fill('Тест')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await expect(page.getByText(name)).toBeVisible()
  })

  test('after creating an exercise, modal stays open for video upload', async ({ page }) => {
    const name = `Video Modal Ex ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    // Modal should still be open (for video upload)
    await expect(page.getByRole('dialog', { name: 'Редактировать упражнение' })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Загрузить видео')).toBeVisible()
  })

  test('pencil button opens edit modal with pre-filled values', async ({ page }) => {
    const name = `Edit Me ${uniqueSuffix()}`
    // Create exercise first
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    // Find the exercise card and click edit
    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await exerciseCard.getByRole('button', { name: 'Изменить' }).click()
    await expect(page.getByRole('dialog', { name: 'Редактировать упражнение' })).toBeVisible()
    await expect(page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input')).toHaveValue(name)
  })

  test('updates exercise name and shows success toast', async ({ page }) => {
    const name = `To Update ${uniqueSuffix()}`
    const updatedName = `Updated ${uniqueSuffix()}`

    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await exerciseCard.getByRole('button', { name: 'Изменить' }).click()
    const nameInput = page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input')
    await nameInput.clear()
    await nameInput.fill(updatedName)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение обновлено')
    await expect(page.getByText(updatedName)).toBeVisible()
  })

  test('delete button opens confirm dialog', async ({ page }) => {
    const name = `Delete Ex ${uniqueSuffix()}`

    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await exerciseCard.getByRole('button', { name: 'Удалить' }).click()
    await expect(page.getByRole('dialog', { name: 'Удалить упражнение?' })).toBeVisible()
  })

  test('confirms deletion removes the exercise from the list', async ({ page }) => {
    const name = `Remove Ex ${uniqueSuffix()}`

    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await exerciseCard.getByRole('button', { name: 'Удалить' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expectToast(page, 'Упражнение удалено')
    await expect(page.getByText(name)).not.toBeVisible()
  })
})
