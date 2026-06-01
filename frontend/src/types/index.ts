// TypeScript mirrors of the backend Go JSON structs.
// Field names match the `json:"..."` tags exactly.

export type Role = 'admin' | 'trainer' | 'client'
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'
export type WorkoutStatus = 'planned' | 'completed' | 'skipped'
export type TemplateScope = 'system' | 'trainer' | 'client'
export type TemplateType = 'confirmation' | 'reschedule' | 'feedback'
export type NotificationType = 'workout_assigned' | 'workout_completed' | 'message'

export interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

export interface User {
  user_id: number
  email: string
  first_name: string
  last_name: string
  role: Role
  created_at: string
  is_active: boolean
}

export interface TokenResponse {
  token: string
}

export interface Trainer {
  trainer_id: number
  user_id: number
  email: string
  first_name: string
  last_name: string
  specialization: string | null
  invite_code: string
}

export interface Client {
  client_id: number
  user_id: number
  trainer_id: number
  email: string
  first_name: string
  last_name: string
  goal: string | null
  weight: number | null
  height: number | null
  level: FitnessLevel | null
  health_notes: string | null
  date_of_birth: string | null
  active_plan?: string | null
  trainer_first_name?: string
  trainer_last_name?: string
}

export interface WorkoutPlan {
  workout_plan_id: number
  client_id: number
  title: string
  description: string | null
  created_at: string
  is_active: boolean
  end_date: string | null
}

export interface Workout {
  workout_id: number
  workout_plan_id: number
  scheduled_date: string
  status: WorkoutStatus
  completed_at: string | null
  duration_minutes: number | null
}

export interface Exercise {
  exercise_id: number
  trainer_id: number | null
  name: string
  description: string | null
  muscle_group: string | null
  video_url?: string | null
}

export interface WorkoutExercise {
  workout_exercise_id: number
  workout_id: number
  exercise_id: number
  exercise_name: string
  sets: number
  reps: number
  weight: number | null
  order: number
}

export interface WorkoutExerciseResult {
  result_id: number
  workout_id: number
  workout_exercise_id: number
  actual_sets: number | null
  actual_reps: number | null
  actual_weight: number | null
  client_comment: string | null
}

export interface FoodEntry {
  food_entry_id: number
  food_log_id: number
  title: string
  description: string | null
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  meal_time: string | null
}

export interface FoodLog {
  food_log_id: number
  client_id: number
  date: string
  entries: FoodEntry[]
}

export interface MessageTemplate {
  message_template_id: number
  user_id: number | null
  text: string
  type: TemplateType
  scope: TemplateScope
}

export interface Notification {
  notification_id: number
  user_id: number
  type: NotificationType
  text: string
  sender_name: string | null
  created_at: string
  is_read: boolean
}

// ── Admin stats ────────────────────────────────────────────────────────────────

export interface AdminMetrics {
  total_users: number
  trainers: number
  clients: number
  active_workouts_today: number
  active_workouts_today_prev: number
  completed_last_30d: number
  completed_prev_30d: number
  new_registrations_7d: number
  new_registrations_prev7d: number
}

export interface DayCount {
  date: string
  count: number
}

export interface GoalCount {
  goal: string
  count: number
}

export interface TrainerStat {
  name: string
  client_count: number
  monthly_sessions: number
  completion_rate: number
}

export interface RecentUser {
  user_id: number
  first_name: string
  last_name: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface AdminStats {
  metrics: AdminMetrics
  activity_chart: DayCount[]
  goal_distribution: GoalCount[]
  top_trainers: TrainerStat[]
  recent_registrations: RecentUser[]
}

// ── Request payloads ───────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string
  first_name: string
  last_name: string
  password: string
  role: 'trainer' | 'client'
  invite_code?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ClientProfilePatch {
  first_name?: string
  last_name?: string
  goal?: string | null
  weight?: number | null
  height?: number | null
  level?: FitnessLevel | null
  health_notes?: string | null
  date_of_birth?: string | null
}

export interface ResultEntryPayload {
  workout_exercise_id: number
  actual_sets?: number | null
  actual_reps?: number | null
  actual_weight?: number | null
  client_comment?: string | null
}
