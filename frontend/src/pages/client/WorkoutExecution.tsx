import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, Field, Input, PageLoader, ProgressBar, Textarea, toast } from '@/components/ui'
import { exerciseApi, workoutApi, workoutExerciseApi } from '@/api'
import { apiError } from '@/api/client'
import { formatDateTime } from '@/lib/format'
import type { Exercise, ResultEntryPayload } from '@/types'

interface DraftResult {
  actual_sets: string
  actual_reps: string
  actual_weight: string
  client_comment: string
}

export default function WorkoutExecution() {
  const { id } = useParams()
  const workoutId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<Record<number, DraftResult>>({})

  const { data: workout, isLoading: lw } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => workoutApi.get(workoutId),
  })
  const { data: exercises, isLoading: le } = useQuery({
    queryKey: ['workout-exercises', workoutId],
    queryFn: () => workoutExerciseApi.list(workoutId),
  })
  const { data: catalogue } = useQuery({ queryKey: ['exercises'], queryFn: exerciseApi.list })
  const { data: results } = useQuery({
    queryKey: ['workout-results', workoutId],
    queryFn: () => workoutExerciseApi.results(workoutId),
  })

  const readOnly = workout ? workout.status !== 'planned' : false

  // Seed drafts from existing results or planned values.
  useEffect(() => {
    if (!exercises) return
    setDrafts((prev) => {
      if (Object.keys(prev).length) return prev
      const seed: Record<number, DraftResult> = {}
      for (const ex of exercises) {
        const r = results?.find((x) => x.workout_exercise_id === ex.workout_exercise_id)
        seed[ex.workout_exercise_id] = {
          actual_sets: String(r?.actual_sets ?? ex.sets ?? ''),
          actual_reps: String(r?.actual_reps ?? ex.reps ?? ''),
          actual_weight: String(r?.actual_weight ?? ex.weight ?? ''),
          client_comment: r?.client_comment ?? '',
        }
      }
      return seed
    })
  }, [exercises, results])

  const catalogueById = useMemo(() => {
    const m = new Map<number, Exercise>()
    catalogue?.forEach((c) => m.set(c.exercise_id, c))
    return m
  }, [catalogue])

  const finish = useMutation({
    mutationFn: async () => {
      const payload: ResultEntryPayload[] = (exercises ?? []).map((ex) => {
        const d = drafts[ex.workout_exercise_id]
        const n = (v: string) => (v === '' ? null : Number(v))
        return {
          workout_exercise_id: ex.workout_exercise_id,
          actual_sets: n(d?.actual_sets ?? ''),
          actual_reps: n(d?.actual_reps ?? ''),
          actual_weight: n(d?.actual_weight ?? ''),
          client_comment: d?.client_comment?.trim() || null,
        }
      })
      await workoutExerciseApi.saveResults(workoutId, payload)
      await workoutApi.complete(workoutId)
    },
    onSuccess: () => {
      toast.success('Тренировка завершена!')
      qc.invalidateQueries({ queryKey: ['my-schedule'] })
      qc.invalidateQueries({ queryKey: ['workout', workoutId] })
      navigate('/schedule')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (lw || le || !workout) return <PageLoader />

  const list = exercises ?? []
  const total = list.length
  const current = list[step]
  const meta = catalogueById.get(current?.exercise_id ?? -1)
  const draft = current ? drafts[current.workout_exercise_id] : undefined

  const setDraft = (k: keyof DraftResult, v: string) => {
    if (!current) return
    setDrafts((d) => ({
      ...d,
      [current.workout_exercise_id]: { ...d[current.workout_exercise_id], [k]: v },
    }))
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Тренировка"
        back="/schedule"
        subtitle={`${formatDateTime(workout.scheduled_date)}${
          workout.duration_minutes ? ` · ${workout.duration_minutes} мин` : ''
        }`}
      />

      {total === 0 ? (
        <Card>
          <CardBody>
            <p className="text-muted">В этой тренировке пока нет упражнений.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Прогресс тренировки</span>
            <span className="text-muted">
              {step + 1} из {total} упражнений
            </span>
          </div>
          <ProgressBar value={step + 1} max={total} className="mb-4" />

          <Card>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">
                    Упражнение {step + 1} из {total}
                  </p>
                  <h2 className="mt-1">{current.exercise_name}</h2>
                </div>
                {meta?.video_url && (
                  <a
                    href={meta.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-btn border border-line px-3 py-1.5 text-sm text-primary hover:bg-page"
                  >
                    <Play className="h-4 w-4" /> Видео
                  </a>
                )}
              </div>
              {meta?.description && <p className="text-sm text-muted">{meta.description}</p>}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted">План</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Plan label="Подходы" value={current.sets} />
                  <Plan label="Повторения" value={current.reps} />
                  <Plan label="Вес, кг" value={current.weight ?? '—'} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted">
                  Фактически выполнено
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Подходы" table="workout_exercise_results" attr="actual_sets">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={draft?.actual_sets ?? ''}
                      onChange={(e) => setDraft('actual_sets', e.target.value)}
                    />
                  </Field>
                  <Field label="Повт." table="workout_exercise_results" attr="actual_reps">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={draft?.actual_reps ?? ''}
                      onChange={(e) => setDraft('actual_reps', e.target.value)}
                    />
                  </Field>
                  <Field label="Вес, кг" table="workout_exercise_results" attr="actual_weight">
                    <Input
                      type="number"
                      step="0.5"
                      disabled={readOnly}
                      value={draft?.actual_weight ?? ''}
                      onChange={(e) => setDraft('actual_weight', e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Комментарий" table="workout_exercise_results" attr="client_comment">
                <Textarea
                  rows={2}
                  disabled={readOnly}
                  placeholder="Например: колено беспокоило на 3-м подходе"
                  value={draft?.client_comment ?? ''}
                  onChange={(e) => setDraft('client_comment', e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              aria-label="Предыдущее упражнение"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {readOnly ? (
              <Button variant="outline" className="flex-1" disabled>
                Тренировка завершена
              </Button>
            ) : (
              <Button
                variant="success"
                className="flex-1"
                loading={finish.isPending}
                onClick={() => finish.mutate()}
              >
                Завершить тренировку
              </Button>
            )}
            <Button
              variant="outline"
              disabled={step === total - 1}
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              aria-label="Следующее упражнение"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {readOnly && (
            <p className="mt-3 text-center text-sm text-muted">
              Тренировка уже завершена — результаты доступны только для просмотра.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Plan({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card bg-page py-2.5">
      <p className="text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
