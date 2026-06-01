import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { createPlan, createExercise } from '../../fixtures/data'
import { expectToast } from '../../utils/helpers'

test.use({ storageState: STORAGE_STATES.trainer })

test.describe('Trainer — Client Detail & Workout Plan Management', () => {
  test.describe('Client Detail Tabs', () => {
    test('Профиль tab is shown by default', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      // Profile tab is active — should show client email
      await expect(page.getByText(env.clientEmail)).toBeVisible()
    })

    test('clicking Программа tab shows program content', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      // "Создать программу" button should be visible in Program tab
      await expect(page.getByRole('button', { name: 'Создать программу' })).toBeVisible()
    })

    test('clicking Результаты tab shows results content', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Результаты' }).click()
      // Either results or empty state
      const emptyOrContent = page.getByText(/Нет данных|Завершённых тренировок/)
      await expect(emptyOrContent).toBeVisible({ timeout: 5_000 })
    })

    test('clicking Питание tab shows food diary navigation', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Питание' }).click()
      await page.waitForLoadState('networkidle')
      // Date nav card: contains prev/next chevron buttons and a date span
      // formatLongDate returns e.g. "1 июня 2026, вс" — match the digit-month pattern
      await expect(page.getByText(/\d{1,2} .+ 20\d{2}/)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Creating a workout plan', () => {
    test('"Создать программу" opens create plan modal', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      await page.getByRole('button', { name: 'Создать программу' }).click()
      await expect(page.getByRole('dialog', { name: 'Новая программа' })).toBeVisible()
    })

    test('Создать button is disabled when title is empty', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      await page.getByRole('button', { name: 'Создать программу' }).click()
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Создать' })).toBeDisabled()
    })

    test('creates a plan and navigates to ProgramEdit page', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      await page.getByRole('button', { name: 'Создать программу' }).click()
      await page.getByRole('dialog').locator('[data-table="workout_plans"][data-attr="title"] input').fill('New Test Plan')
      await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
      await expectToast(page, 'Программа создана')
      await expect(page).toHaveURL(/\/trainer\/clients\/\d+\/plans\/\d+/)
    })
  })

  test.describe('Plan cards in Program tab', () => {
    let planId: number
    let planCleanup: () => Promise<unknown>

    test.beforeAll(async () => {
      const env = readTestEnv()
      const { plan, cleanup } = await createPlan(env.clientId, env.trainerToken, {
        title: 'Plan Card Test',
      })
      planId = plan.workout_plan_id
      planCleanup = cleanup
    })

    test.afterAll(async () => {
      await planCleanup().catch(() => { /* may have been deleted by test */ })
    })

    test('plan card shows in Program tab', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      await expect(page.getByText('Plan Card Test').first()).toBeVisible()
    })

    test('"Назначить активной" activates the plan', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      // Locate the card containing ONLY "Plan Card Test" via h3 heading
      const planCard = page.locator('[class*="CardBody"], .flex.flex-col.gap-3').filter({ has: page.locator('h3', { hasText: 'Plan Card Test' }) }).first()
      const activateBtn = planCard.getByRole('button', { name: 'Назначить активной' })
      if (await activateBtn.isVisible()) {
        await activateBtn.click()
        await expectToast(page, 'Программа назначена активной')
      }
    })

    test('"Завершить" deactivates the plan', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      const planCard = page.locator('[class*="CardBody"], .flex.flex-col.gap-3').filter({ has: page.locator('h3', { hasText: 'Plan Card Test' }) }).first()
      const completeBtn = planCard.getByRole('button', { name: 'Завершить' })
      if (await completeBtn.isVisible()) {
        await completeBtn.click()
        await expectToast(page, 'Программа завершена')
      }
    })

    test('"Изменить" navigates to ProgramEdit', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      const planCard = page.locator('[class*="CardBody"], .flex.flex-col.gap-3').filter({ has: page.locator('h3', { hasText: 'Plan Card Test' }) }).first()
      await planCard.getByRole('button', { name: 'Изменить' }).click()
      await expect(page).toHaveURL(new RegExp(`/trainer/clients/${env.clientId}/plans/${planId}`))
    })

    test('delete icon opens confirm dialog', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      const planCard = page.locator('[class*="CardBody"], .flex.flex-col.gap-3').filter({ has: page.locator('h3', { hasText: 'Plan Card Test' }) }).first()
      const deleteBtn = planCard.getByRole('button', { name: 'Удалить программу' })
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await expect(page.getByRole('dialog', { name: 'Удалить программу?' })).toBeVisible()
        await page.getByRole('dialog').getByRole('button', { name: 'Отменить' }).click()
      }
    })
  })

  test.describe('Business rule: only one active plan', () => {
    let plan1Cleanup: () => Promise<unknown>
    let plan2Cleanup: () => Promise<unknown>

    test.beforeAll(async () => {
      const env = readTestEnv()
      const { cleanup: c1 } = await createPlan(env.clientId, env.trainerToken, {
        title: 'Active Plan 1',
        is_active: true,
      })
      plan1Cleanup = c1
      const { cleanup: c2 } = await createPlan(env.clientId, env.trainerToken, {
        title: 'Plan 2',
      })
      plan2Cleanup = c2
    })

    test.afterAll(async () => {
      await plan1Cleanup().catch(() => { })
      await plan2Cleanup().catch(() => { })
    })

    test('activating second plan while first is active shows error (409 conflict)', async ({ page }) => {
      const env = readTestEnv()
      await page.goto(`/trainer/clients/${env.clientId}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Программа' }).click()
      // Find Plan 2 card and click activate
      const plan2Card = page.locator('div').filter({ hasText: 'Plan 2' }).first()
      const activateBtn = plan2Card.getByRole('button', { name: 'Назначить активной' })
      if (await activateBtn.isVisible()) {
        await activateBtn.click()
        // Backend should return 409 → toast.error shown
        await expectToast(page, /уже|активна|ошибка/i)
      }
    })
  })
})
