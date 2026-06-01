import { apiPost, apiDelete, apiGet } from './auth'

export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export async function createExercise(token: string, overrides: Record<string, unknown> = {}) {
  const name = `Test Exercise ${uniqueSuffix()}`
  const exercise = await apiPost('/exercises', {
    name,
    muscle_group: 'Тест',
    description: 'Автоматический тест',
    ...overrides,
  }, token) as { exercise_id: number; name: string }
  return {
    exercise,
    cleanup: () => apiDelete(`/exercises/${exercise.exercise_id}`, token),
  }
}

export async function createPlan(
  clientId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const plan = await apiPost(`/trainer/clients/${clientId}/plans`, {
    title: `Test Plan ${uniqueSuffix()}`,
    is_active: false,
    ...overrides,
  }, token) as { workout_plan_id: number; title: string }
  return {
    plan,
    cleanup: () => apiDelete(`/trainer/clients/${clientId}/plans/${plan.workout_plan_id}`, token),
  }
}

export async function createActivePlan(
  clientId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  return createPlan(clientId, token, { is_active: true, ...overrides })
}

export async function createWorkout(
  planId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const scheduled = new Date(Date.now() + 86_400_000).toISOString()
  const workout = await apiPost(`/plans/${planId}/workouts`, {
    scheduled_date: scheduled,
    duration_minutes: 60,
    ...overrides,
  }, token) as { workout_id: number }
  return { workout }
}

export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  return apiPost(`/workouts/${workoutId}/exercises`, {
    exercise_id: exerciseId,
    sets: 3,
    reps: 10,
    weight: 20,
    order: 1,
    ...overrides,
  }, token) as Promise<{ workout_exercise_id: number }>
}

export async function createTemplate(
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const template = await apiPost('/message-templates', {
    text: `Test template ${uniqueSuffix()}`,
    type: 'confirmation',
    scope: 'trainer',
    ...overrides,
  }, token) as { message_template_id: number; text: string }
  return {
    template,
    cleanup: () => apiDelete(`/message-templates/${template.message_template_id}`, token),
  }
}

export async function createFoodEntry(
  date: string,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const entry = await apiPost(`/clients/me/food-logs/${date}/entries`, {
    title: `Test Food ${uniqueSuffix()}`,
    calories: 300,
    protein: 20,
    fat: 10,
    carbs: 30,
    ...overrides,
  }, token) as { food_entry_id: number; title: string }
  return {
    entry,
    cleanup: () => apiDelete(`/clients/me/food-logs/entries/${entry.food_entry_id}`, token),
  }
}

export async function getClientId(token: string): Promise<number> {
  const client = await apiGet('/clients/me', token) as { client_id: number }
  return client.client_id
}

export async function getTrainerId(token: string): Promise<number> {
  const trainer = await apiGet('/trainers/me', token) as { trainer_id: number }
  return trainer.trainer_id
}
