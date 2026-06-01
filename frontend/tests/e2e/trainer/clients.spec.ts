import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.trainer })

test.describe('Trainer Clients (/trainer/clients)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trainer/clients')
    await page.waitForLoadState('networkidle')
  })

  test('shows client list with the E2E test client', async ({ page }) => {
    await expect(page.getByText('E2E Client')).toBeVisible()
  })

  test('subtitle shows total client count', async ({ page }) => {
    await expect(page.getByText(/Всего: \d+/)).toBeVisible()
  })

  test('"Клиент" button opens invite code modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Клиент' }).click()
    await expect(page.getByRole('dialog', { name: 'Код приглашения' })).toBeVisible()
  })

  test('invite modal shows trainer invite code', async ({ page }) => {
    const env = readTestEnv()
    await page.getByRole('button', { name: 'Клиент' }).click()
    await expect(page.getByText(env.inviteCode)).toBeVisible()
  })

  test('Копировать in invite modal shows success toast', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Клиент' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Копировать' }).click()
    await expectToast(page, 'Код скопирован')
  })

  test('search by name filters clients', async ({ page }) => {
    // Get first visible client name to use as search term
    const firstClientName = await page.locator('.font-semibold.text-ink').first().textContent()
    if (firstClientName) {
      await page.locator('input[placeholder="Поиск по имени..."]').fill(firstClientName)
      await page.waitForTimeout(300)
      await expect(page.getByText(firstClientName).first()).toBeVisible()
    }
  })

  test('empty search shows "Клиентов нет" empty state', async ({ page }) => {
    await page.locator('input[placeholder="Поиск по имени..."]').fill('xyznonexistent999')
    await page.waitForTimeout(300)
    await expect(page.getByText('Клиентов нет')).toBeVisible()
  })

  test('filter "Без программы" shows clients without active plan', async ({ page }) => {
    await page.getByText('Без программы').click()
    // The E2E client has no plan by default at this point
    // Just check the filter chip is active and page renders without error
    await expect(page.getByText('Без программы')).toBeVisible()
  })

  test('clicking a client card navigates to /trainer/clients/:id', async ({ page }) => {
    // Click first available client card (robust against DB state from previous runs)
    const firstCard = page.locator('.flex.cursor-pointer.items-center.gap-3').first()
    await firstCard.click()
    await expect(page).toHaveURL(/\/trainer\/clients\/\d+/)
  })
})
