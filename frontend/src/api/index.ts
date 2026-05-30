import { http, unwrap } from './client'
import type {
  Client,
  ClientProfilePatch,
  Exercise,
  FoodEntry,
  FoodLog,
  LoginPayload,
  MessageTemplate,
  Notification,
  RegisterPayload,
  ResultEntryPayload,
  TemplateType,
  TokenResponse,
  Trainer,
  User,
  Workout,
  WorkoutExercise,
  WorkoutExerciseResult,
  WorkoutPlan,
} from '@/types'

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (payload: RegisterPayload) => unwrap<User>(http.post('/auth/register', payload)),
  login: (payload: LoginPayload) => unwrap<TokenResponse>(http.post('/auth/login', payload)),
}

// ── Client profile ────────────────────────────────────────────────────────────
export const clientApi = {
  me: () => unwrap<Client>(http.get('/clients/me')),
  patchMe: (patch: ClientProfilePatch) => unwrap<Client>(http.patch('/clients/me', patch)),
  myActivePlan: () => unwrap<WorkoutPlan>(http.get('/clients/me/plans')),
  schedule: () => unwrap<Workout[]>(http.get('/clients/me/schedule')),
}

// ── Trainer profile + clients ───────────────────────────────────────────────
export const trainerApi = {
  me: () => unwrap<Trainer>(http.get('/trainers/me')),
  patchMe: (patch: { specialization?: string | null }) =>
    unwrap<Trainer>(http.patch('/trainers/me', patch)),
  inviteCode: () => unwrap<{ invite_code: string }>(http.get('/trainers/me/invite-code')),
  clients: () => unwrap<Client[]>(http.get('/trainer/clients')),
  client: (id: number) => unwrap<Client>(http.get(`/trainer/clients/${id}`)),
  clientFoodLog: (id: number, date: string) =>
    unwrap<FoodLog>(http.get(`/trainer/clients/${id}/food-logs/${date}`)),
}

// ── Workout plans ─────────────────────────────────────────────────────────────
export const planApi = {
  list: (clientId: number) =>
    unwrap<WorkoutPlan[]>(http.get(`/trainer/clients/${clientId}/plans`)),
  get: (clientId: number, planId: number) =>
    unwrap<WorkoutPlan>(http.get(`/trainer/clients/${clientId}/plans/${planId}`)),
  create: (
    clientId: number,
    body: { title: string; description?: string | null; end_date?: string | null; is_active?: boolean },
  ) => unwrap<WorkoutPlan>(http.post(`/trainer/clients/${clientId}/plans`, body)),
  patch: (
    clientId: number,
    planId: number,
    body: {
      title?: string
      description?: string | null
      end_date?: string | null
      is_active?: boolean
    },
  ) => unwrap<WorkoutPlan>(http.patch(`/trainer/clients/${clientId}/plans/${planId}`, body)),
  remove: (clientId: number, planId: number) =>
    unwrap<{ deleted: boolean }>(http.delete(`/trainer/clients/${clientId}/plans/${planId}`)),
}

// ── Workouts ──────────────────────────────────────────────────────────────────
export const workoutApi = {
  listByPlan: (planId: number) => unwrap<Workout[]>(http.get(`/plans/${planId}/workouts`)),
  get: (id: number) => unwrap<Workout>(http.get(`/workouts/${id}`)),
  create: (planId: number, body: { scheduled_date: string; duration_minutes?: number | null }) =>
    unwrap<Workout>(http.post(`/plans/${planId}/workouts`, body)),
  patch: (id: number, body: { scheduled_date?: string; duration_minutes?: number | null }) =>
    unwrap<Workout>(http.patch(`/workouts/${id}`, body)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(http.delete(`/workouts/${id}`)),
  complete: (id: number) => unwrap<{ completed: boolean }>(http.post(`/workouts/${id}/complete`)),
}

// ── Workout exercises + results ────────────────────────────────────────────────
export const workoutExerciseApi = {
  list: (workoutId: number) =>
    unwrap<WorkoutExercise[]>(http.get(`/workouts/${workoutId}/exercises`)),
  add: (
    workoutId: number,
    body: { exercise_id: number; sets: number; reps: number; weight?: number | null; order: number },
  ) => unwrap<WorkoutExercise>(http.post(`/workouts/${workoutId}/exercises`, body)),
  remove: (workoutId: number, workoutExerciseId: number) =>
    unwrap<{ deleted: boolean }>(http.delete(`/workouts/${workoutId}/exercises/${workoutExerciseId}`)),
  saveResults: (workoutId: number, results: ResultEntryPayload[]) =>
    unwrap<{ saved: boolean }>(http.post(`/workouts/${workoutId}/results`, { results })),
  results: (workoutId: number) =>
    unwrap<WorkoutExerciseResult[]>(http.get(`/workouts/${workoutId}/results`)),
}

// ── Exercises catalogue ────────────────────────────────────────────────────────
export const exerciseApi = {
  list: () => unwrap<Exercise[]>(http.get('/exercises')),
  get: (id: number) => unwrap<Exercise>(http.get(`/exercises/${id}`)),
  create: (body: { name: string; description?: string | null; muscle_group?: string | null }) =>
    unwrap<Exercise>(http.post('/exercises', body)),
  patch: (
    id: number,
    body: { name?: string; description?: string | null; muscle_group?: string | null },
  ) => unwrap<Exercise>(http.patch(`/exercises/${id}`, body)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(http.delete(`/exercises/${id}`)),
  uploadVideo: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return unwrap<{ uploaded: boolean }>(
      http.post(`/exercises/${id}/video`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },
}

// ── Food diary ─────────────────────────────────────────────────────────────────
export interface FoodEntryPayload {
  title: string
  description?: string | null
  calories?: number | null
  protein?: number | null
  fat?: number | null
  carbs?: number | null
  meal_time?: string | null
}

export const foodApi = {
  log: (date: string) => unwrap<FoodLog>(http.get(`/clients/me/food-logs/${date}`)),
  addEntry: (date: string, body: FoodEntryPayload) =>
    unwrap<FoodEntry>(http.post(`/clients/me/food-logs/${date}/entries`, body)),
  patchEntry: (id: number, body: FoodEntryPayload) =>
    unwrap<FoodEntry>(http.patch(`/clients/me/food-logs/entries/${id}`, body)),
  deleteEntry: (id: number) =>
    unwrap<{ deleted: boolean }>(http.delete(`/clients/me/food-logs/entries/${id}`)),
}

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => unwrap<Notification[]>(http.get('/notifications')),
  markRead: (id: number) => unwrap<{ read: boolean }>(http.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap<{ read: boolean }>(http.post('/notifications/read-all')),
}

// ── Message templates ──────────────────────────────────────────────────────────
export const templateApi = {
  list: () => unwrap<MessageTemplate[]>(http.get('/message-templates')),
  create: (body: { text: string; type: TemplateType; scope?: string }) =>
    unwrap<MessageTemplate>(http.post('/message-templates', body)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(http.delete(`/message-templates/${id}`)),
  send: (id: number, clientUserId: number) =>
    unwrap<{ sent: boolean }>(http.post(`/message-templates/${id}/send`, { client_user_id: clientUserId })),
}

// ── Admin users ────────────────────────────────────────────────────────────────
export const adminApi = {
  users: () => unwrap<User[]>(http.get('/admin/users')),
  user: (id: number) => unwrap<User>(http.get(`/admin/users/${id}`)),
  patchUser: (id: number, body: { role?: string; is_active?: boolean }) =>
    unwrap<User>(http.patch(`/admin/users/${id}`, body)),
  removeUser: (id: number) => unwrap<{ deleted: boolean }>(http.delete(`/admin/users/${id}`)),
}
