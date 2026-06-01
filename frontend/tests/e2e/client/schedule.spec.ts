import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { createActivePlan, createWorkout } from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.client })

test.describe('Client Schedule (/schedule)', () => {
  test('page loads with schedule title', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Расписание' })).toBeVisible()
  })

  test.describe('with an active plan and workouts', () => {
    let planId: number
    let workoutId: number
    let cleanup: () => Promise<unknown>

    test.beforeAll(async () => {
      const env = readTestEnv()
      const { plan, cleanup: cleanupPlan } = await createActivePlan(env.clientId, env.trainerToken, {
        title: 'Schedule Test Plan',
      })
      planId = plan.workout_plan_id
      cleanup = cleanupPlan

      const tomorrow = new Date(Date.now() + 86_400_000).toISOString()
      const { workout } = await createWorkout(planId, env.trainerToken, {
        scheduled_date: tomorrow,
        duration_minutes: 45,
      })
      workoutId = workout.workout_id
    })

    test.afterAll(async () => {
      await cleanup()
    })

    test('shows active plan title in subtitle', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Schedule Test Plan')).toBeVisible()
    })

    test('shows workout cards', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Тренировка').first()).toBeVisible()
    })

    test('filter Предстоящие shows planned workouts', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await page.getByText('Предстоящие').click()
      // planned workout should still be visible (use first() in case multiple exist)
      await expect(page.getByText('Начать').first()).toBeVisible()
    })

    test('filter Завершённые shows no planned workouts', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await page.getByText('Завершённые').click()
      // The planned workout should not show the "Начать" button
      await expect(page.getByText('Начать')).not.toBeVisible()
    })

    test('clicking Начать navigates to workout execution page', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await page.getByText('Начать').first().click()
      await expect(page).toHaveURL(new RegExp(`/workout/\\d+`))
    })

    test('shows 45 мин duration on workout card', async ({ page }) => {
      await page.goto('/schedule')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('45 мин').first()).toBeVisible()
    })
  })
})
