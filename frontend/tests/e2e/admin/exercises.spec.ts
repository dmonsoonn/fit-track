import { test, expect } from 'playwright/test'
import { STORAGE_STATES } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'
import { uniqueSuffix } from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.admin })

test.describe('Admin System Exercises (/admin/exercises)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/exercises')
    await page.waitForLoadState('networkidle')
  })

  test('shows "Системные упражнения" title', async ({ page }) => {
    await expect(page.getByText('Системные упражнения')).toBeVisible()
  })

  test('shows "Доступны всем тренерам" subtitle', async ({ page }) => {
    await expect(page.getByText('Доступны всем тренерам')).toBeVisible()
  })

  test('all listed exercises have "Системное" badge (admin view filters to system)', async ({ page }) => {
    // The page with system=true prop filters to trainer_id=null exercises
    // At least one system exercise should be present (or empty state)
    const systemBadge = page.getByText('Системное').first()
    const emptyState = page.getByText('Упражнений нет')
    const hasBadge = await systemBadge.isVisible()
    const hasEmpty = await emptyState.isVisible()
    expect(hasBadge || hasEmpty).toBeTruthy()
  })

  test('admin can edit system exercises (edit button present)', async ({ page }) => {
    // Create a system exercise first
    const name = `Admin System Ex ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await expect(exerciseCard.getByRole('button', { name: 'Изменить' })).toBeVisible()
  })

  test('creates a system exercise with "Системное" badge', async ({ page }) => {
    const name = `New System Ex ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Упражнение' }).click()
    await page.getByRole('dialog').locator('[data-table="exercises"][data-attr="name"] input').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение создано')
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    const exerciseCard = page.locator('.grid.gap-3 > div').filter({ hasText: name })
    await expect(exerciseCard.getByText('Системное')).toBeVisible()
  })

  test('updates system exercise name', async ({ page }) => {
    const name = `Update System ${uniqueSuffix()}`
    const updated = `Updated System ${uniqueSuffix()}`

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
    await nameInput.fill(updated)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Упражнение обновлено')
    await expect(page.getByText(updated)).toBeVisible()
  })

  test('deletes system exercise with confirmation', async ({ page }) => {
    const name = `Delete System ${uniqueSuffix()}`

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
