import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, ConfirmDialog, DateTimeInput, EmptyState, Field, Input, Modal, PageLoader, Select, toast } from '@/components/ui'
import { exerciseApi, workoutApi, workoutExerciseApi } from '@/api'
import { apiError } from '@/api/client'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'

type PendingExercise = {
  localId: number
  exercise_id: number
  exercise_name: string
  sets: number
  reps: number
  weight: number | null
  order: number
}

export default function WorkoutForm() {
  const { id, planId: routePlanId } = useParams()
  const [params] = useSearchParams()
  const clientId = params.get('clientId')
  const queryPlanId = params.get('planId')
  const effectivePlanId = routePlanId ?? queryPlanId
  const navigate = useNavigate()
  const qc = useQueryClient()

  const isEdit = !!id
  const workoutId = id ? Number(id) : null

  const [scheduledDate, setScheduledDate] = useState('')
  const [duration, setDuration] = useState('')
  const [pending, setPending] = useState<PendingExercise[]>([])
  const [saving, setSaving] = useState(false)
  const { setDirty, blocker } = useUnsavedGuard()

  const { data: workout, isLoading: lw } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => workoutApi.get(workoutId!),
    enabled: isEdit,
  })
  const { data: exercises } = useQuery({
    queryKey: ['workout-exercises', workoutId],
    queryFn: () => workoutExerciseApi.list(workoutId!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (workout) {
      setScheduledDate(workout.scheduled_date ?? '')
      setDuration(workout.duration_minutes ? String(workout.duration_minutes) : '')
    }
  }, [workout])

  const backTo = effectivePlanId && clientId
    ? `/trainer/clients/${clientId}/plans/${effectivePlanId}`
    : clientId ? `/trainer/clients/${clientId}` : '/trainer/clients'

  const validateWorkout = (): boolean => {
    if (duration && Number(duration) <= 0) {
      toast.error('Длительность должна быть больше нуля')
      return false
    }
    return true
  }

  const patchMut = useMutation({
    mutationFn: () =>
      workoutApi.patch(workoutId!, {
        scheduled_date: scheduledDate || undefined,
        duration_minutes: duration ? Number(duration) : null,
      }),
    onSuccess: () => {
      toast.success('Сохранено. Клиент уведомлён о тренировке.')
      qc.invalidateQueries({ queryKey: ['workout', workoutId] })
      qc.invalidateQueries({ queryKey: ['plan-workouts'] })
      setDirty(false)
      navigate(backTo)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const handleCreateSave = async () => {
    if (!validateWorkout()) return
    setSaving(true)
    try {
      const w = await workoutApi.create(Number(effectivePlanId), {
        scheduled_date: scheduledDate,
        duration_minutes: duration ? Number(duration) : null,
      })
      await Promise.all(
        pending.map((ex) =>
          workoutExerciseApi.add(w.workout_id, {
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            order: ex.order,
          })
        )
      )
      qc.invalidateQueries({ queryKey: ['plan-workouts'] })
      toast.success('Тренировка сохранена. Клиент уведомлён.')
      setDirty(false)
      navigate(backTo)
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  const [pickerOpen, setPickerOpen] = useState(false)

  const exerciseCount = isEdit ? (exercises ?? []).length : pending.length

  if (isEdit && lw) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={isEdit ? 'Тренировка' : 'Новая тренировка'} back={backTo} />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field label="Дата и время" table="workouts" attr="scheduled_date">
            <DateTimeInput
              value={scheduledDate || null}
              onChange={(v) => { setDirty(true); setScheduledDate(v ?? '') }}
            />
          </Field>
          <Field label="Длительность, мин" table="workouts" attr="duration_minutes">
            <Input
              type="number"
              value={duration}
              onChange={(e) => { setDirty(true); setDuration(e.target.value) }}
              placeholder="60"
            />
          </Field>
        </CardBody>
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <h3>Упражнения</h3>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {exerciseCount === 0 ? (
          <EmptyState title="Упражнений ещё нет" />
        ) : isEdit ? (
          (exercises ?? [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((ex) => (
              <Card key={ex.workout_exercise_id} className="flex items-center gap-2 p-3">
                <GripVertical className="h-5 w-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{ex.exercise_name}</p>
                  <p className="text-sm text-muted">
                    {ex.sets} подх. × {ex.reps} повт.{ex.weight != null ? ` · ${ex.weight} кг` : ''}
                  </p>
                </div>
                <RemoveExerciseButton workoutId={workoutId!} workoutExerciseId={ex.workout_exercise_id} />
              </Card>
            ))
        ) : (
          pending.map((ex) => (
            <Card key={ex.localId} className="flex items-center gap-2 p-3">
              <GripVertical className="h-5 w-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{ex.exercise_name}</p>
                <p className="text-sm text-muted">
                  {ex.sets} подх. × {ex.reps} повт.{ex.weight != null ? ` · ${ex.weight} кг` : ''}
                </p>
              </div>
              <button
                onClick={() => setPending((p) => p.filter((e) => e.localId !== ex.localId))}
                className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                aria-label="Удалить упражнение"
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={isEdit ? () => { if (validateWorkout()) patchMut.mutate() } : handleCreateSave}
          loading={isEdit ? patchMut.isPending : saving}
          disabled={!scheduledDate}
        >
          Сохранить и уведомить
        </Button>
      </div>

      <AddExerciseModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workoutId={isEdit ? workoutId! : undefined}
        nextOrder={exerciseCount}
        onLocalAdd={(ex) => {
          setDirty(true)
          setPending((p) => [...p, ex])
          setPickerOpen(false)
        }}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Несохранённые изменения"
        message="Изменения будут потеряны. Продолжить?"
        confirmLabel="Уйти"
      />
    </div>
  )
}

function RemoveExerciseButton({ workoutId, workoutExerciseId }: { workoutId: number; workoutExerciseId: number }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => workoutExerciseApi.remove(workoutId, workoutExerciseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-exercises', workoutId] }),
    onError: (e) => toast.error(apiError(e)),
  })
  return (
    <button
      onClick={() => mut.mutate()}
      className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
      aria-label="Удалить упражнение"
    >
      <X className="h-4 w-4" />
    </button>
  )
}

function AddExerciseModal({
  open, onClose, workoutId, nextOrder, onLocalAdd,
}: {
  open: boolean
  onClose: () => void
  workoutId?: number
  nextOrder: number
  onLocalAdd?: (ex: PendingExercise) => void
}) {
  const qc = useQueryClient()
  const { data: catalogue } = useQuery({ queryKey: ['exercises'], queryFn: exerciseApi.list, enabled: open })
  const [exerciseId, setExerciseId] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('')
  const localIdRef = useRef(0)

  const addServer = useMutation({
    mutationFn: () =>
      workoutExerciseApi.add(workoutId!, {
        exercise_id: Number(exerciseId),
        sets: Number(sets),
        reps: Number(reps),
        weight: weight ? Number(weight) : null,
        order: nextOrder,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-exercises', workoutId] })
      onClose()
      setExerciseId('')
      setWeight('')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const handleAdd = () => {
    if (Number(sets) <= 0) { toast.error('Подходы должны быть больше нуля'); return }
    if (Number(reps) <= 0) { toast.error('Повторения должны быть больше нуля'); return }
    if (workoutId !== undefined) {
      addServer.mutate()
    } else {
      const selected = (catalogue ?? []).find((ex) => ex.exercise_id === Number(exerciseId))
      onLocalAdd?.({
        localId: ++localIdRef.current,
        exercise_id: Number(exerciseId),
        exercise_name: selected?.name ?? '',
        sets: Number(sets),
        reps: Number(reps),
        weight: weight ? Number(weight) : null,
        order: nextOrder,
      })
      setExerciseId('')
      setWeight('')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить упражнение"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button
            onClick={handleAdd}
            loading={addServer.isPending}
            disabled={!exerciseId}
          >
            Добавить
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Упражнение" table="workout_exercises" attr="exercise_id">
          <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">Выберите упражнение…</option>
            {(catalogue ?? []).map((ex) => (
              <option key={ex.exercise_id} value={ex.exercise_id}>
                {ex.name}
                {ex.muscle_group ? ` (${ex.muscle_group})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Подходы" table="workout_exercises" attr="sets">
            <Input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <Field label="Повторения" table="workout_exercises" attr="reps">
            <Input type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="Вес, кг" table="workout_exercises" attr="weight">
            <Input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
