import { test, expect } from 'playwright/test'
import { STORAGE_STATES } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.client })

test.describe('Food Diary (/food-diary)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/food-diary')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with today\'s date and daily summary', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Дневник питания' })).toBeVisible()
    await expect(page.getByText('Сводка за день')).toBeVisible()
    await expect(page.getByText('ккал')).toBeVisible()
  })

  test('ChevronLeft navigates to previous day', async ({ page }) => {
    const currentDate = await page.locator('.font-semibold').first().textContent()
    await page.getByRole('button').filter({ has: page.locator('svg') }).first().click()
    const newDate = await page.locator('.font-semibold').first().textContent()
    expect(newDate).not.toBe(currentDate)
  })

  test('ChevronRight navigates to next day', async ({ page }) => {
    // The date card has prev/next chevron buttons; the date text is a span.font-semibold inside the card
    const dateCard = page.locator('.flex.items-center.justify-between').first()
    const currentDate = await dateCard.locator('span.font-semibold').textContent()
    await dateCard.locator('button').last().click()
    const newDate = await dateCard.locator('span.font-semibold').textContent()
    expect(newDate).not.toBe(currentDate)
  })

  test('add button opens "Новый приём пищи" modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await expect(page.getByRole('dialog', { name: 'Новый приём пищи' })).toBeVisible()
  })

  test('Сохранить is disabled when title is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // title is empty by default
    const saveBtn = page.getByRole('dialog').getByRole('button', { name: 'Сохранить' })
    await expect(saveBtn).toBeDisabled()
  })

  test('creates a food entry and it appears in the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('Test Meal Entry')
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="calories"] input').fill('500')
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="protein"] input').fill('30')
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="fat"] input').fill('15')
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="carbs"] input').fill('60')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')
    await expect(page.getByText('Test Meal Entry')).toBeVisible()
  })

  test('daily totals update after adding an entry', async ({ page }) => {
    // First check current calorie total
    const calStat = page.locator('.grid.grid-cols-4 .text-xl').first()
    const beforeStr = await calStat.textContent()
    const before = parseInt(beforeStr ?? '0', 10)

    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('Calorie Test Meal')
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="calories"] input').fill('200')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')

    // Wait for re-render
    await page.waitForTimeout(500)
    const afterStr = await calStat.textContent()
    const after = parseInt(afterStr ?? '0', 10)
    expect(after).toBeGreaterThan(before)
  })

  test('edit pencil opens modal with pre-filled values', async ({ page }) => {
    // Create an entry first
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('Editable Meal')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')

    // Click edit on the newly created entry
    await page.getByRole('button', { name: 'Редактировать' }).last().click()
    await expect(page.getByRole('dialog', { name: 'Редактировать запись' })).toBeVisible()
    await expect(
      page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input'),
    ).toHaveValue('Editable Meal')
  })

  test('updates food entry title and shows success toast', async ({ page }) => {
    // Create then edit
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('Before Update')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')

    await page.getByRole('button', { name: 'Редактировать' }).last().click()
    const titleInput = page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input')
    await titleInput.clear()
    await titleInput.fill('After Update')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись обновлена')
    await expect(page.getByText('After Update')).toBeVisible()
  })

  test('delete X button opens confirmation dialog', async ({ page }) => {
    // Create entry first
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('Delete Me')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')

    await page.getByRole('button', { name: 'Удалить' }).last().click()
    await expect(page.getByRole('dialog', { name: 'Удалить запись?' })).toBeVisible()
  })

  test('confirming deletion removes the entry', async ({ page }) => {
    // Create entry
    await page.getByRole('button', { name: 'Добавить приём пищи' }).click()
    await page.getByRole('dialog').locator('[data-table="food_entries"][data-attr="title"] input').fill('To Be Deleted')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expectToast(page, 'Запись добавлена')

    // Delete
    await page.getByRole('button', { name: 'Удалить' }).last().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expectToast(page, 'Запись удалена')
    await expect(page.getByText('To Be Deleted')).not.toBeVisible()
  })
})
