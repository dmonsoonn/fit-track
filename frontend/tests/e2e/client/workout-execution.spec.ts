import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import {
  createActivePlan,
  createWorkout,
  createExercise,
  addExerciseToWorkout,
} from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.client })

test.describe('Workout Execution (/workout/:id)', () => {
  let workoutId: number
  let planCleanup: () => Promise<unknown>
  let ex1Cleanup: () => Promise<unknown>
  let ex2Cleanup: () => Promise<unknown>

  test.beforeAll(async () => {
    const env = readTestEnv()

    const { plan, cleanup } = await createActivePlan(env.clientId, env.trainerToken, {
      title: 'Execution Test Plan',
    })
    planCleanup = cleanup

    const { workout } = await createWorkout(plan.workout_plan_id, env.trainerToken)
    workoutId = workout.workout_id

    // Create 2 exercises and add them to the workout
    const { exercise: ex1, cleanup: c1 } = await createExercise(env.trainerToken, {
      name: 'Exercise Alpha',
    })
    ex1Cleanup = c1
    const { exercise: ex2, cleanup: c2 } = await createExercise(env.trainerToken, {
      name: 'Exercise Beta',
    })
    ex2Cleanup = c2

    await addExerciseToWorkout(workoutId, ex1.exercise_id, env.trainerToken, { order: 1 })
    await addExerciseToWorkout(workoutId, ex2.exercise_id, env.trainerToken, { order: 2 })
  })

  test.afterAll(async () => {
    await planCleanup()
    await ex1Cleanup()
    await ex2Cleanup()
  })

  test('shows progress "1 из 2 упражнений"', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('1 из 2 упражнений')).toBeVisible()
  })

  test('shows exercise name', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Exercise Alpha')).toBeVisible()
  })

  test('actual input fields are editable', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    const setsInput = page.locator('[data-table="workout_exercise_results"][data-attr="actual_sets"] input')
    await expect(setsInput).not.toBeDisabled()
    await setsInput.clear()
    await setsInput.fill('4')
    await expect(setsInput).toHaveValue('4')
  })

  test('ChevronRight navigates to exercise 2', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Следующее упражнение' }).click()
    await expect(page.getByText('Exercise Beta')).toBeVisible()
    await expect(page.getByText('2 из 2 упражнений')).toBeVisible()
  })

  test('ChevronLeft returns to exercise 1', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Следующее упражнение' }).click()
    await page.getByRole('button', { name: 'Предыдущее упражнение' }).click()
    await expect(page.getByText('Exercise Alpha')).toBeVisible()
  })

  test('Предыдущее упражнение button is disabled on first exercise', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Предыдущее упражнение' })).toBeDisabled()
  })

  test('Следующее упражнение button is disabled on last exercise', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Следующее упражнение' }).click()
    await expect(page.getByRole('button', { name: 'Следующее упражнение' })).toBeDisabled()
  })

  test('Завершить тренировку completes workout and redirects to /schedule', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Завершить тренировку' }).click()
    await page.waitForURL('**/schedule', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/schedule/)
  })

  test('completed workout shows disabled "Тренировка завершена" button', async ({ page }) => {
    // workoutId was just completed in the previous test
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    const btn = page.getByRole('button', { name: 'Тренировка завершена' })
    await expect(btn).toBeVisible()
    await expect(btn).toBeDisabled()
  })

  test('completed workout shows read-only note', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Тренировка уже завершена')).toBeVisible()
  })

  test('completed workout inputs are disabled', async ({ page }) => {
    await page.goto(`/workout/${workoutId}`)
    await page.waitForLoadState('networkidle')
    const setsInput = page.locator('[data-table="workout_exercise_results"][data-attr="actual_sets"] input')
    await expect(setsInput).toBeDisabled()
  })

  test.describe('empty workout', () => {
    let emptyWorkoutId: number
    let emptyPlanCleanup: () => Promise<unknown>

    test.beforeAll(async () => {
      const env = readTestEnv()
      const { plan, cleanup } = await createActivePlan(env.clientId, env.trainerToken, {
        title: 'Empty Workout Plan',
      })
      emptyPlanCleanup = cleanup
      const { workout } = await createWorkout(plan.workout_plan_id, env.trainerToken)
      emptyWorkoutId = workout.workout_id
    })

    test.afterAll(async () => {
      await emptyPlanCleanup()
    })

    test('shows "В этой тренировке пока нет упражнений."', async ({ page }) => {
      await page.goto(`/workout/${emptyWorkoutId}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('В этой тренировке пока нет упражнений.')).toBeVisible()
    })
  })
})
