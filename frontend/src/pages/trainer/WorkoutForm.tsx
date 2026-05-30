import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, EmptyState, Field, Input, Modal, PageLoader, Select, toast } from '@/components/ui'
import { exerciseApi, workoutApi, workoutExerciseApi } from '@/api'
import { apiError } from '@/api/client'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'

export default function WorkoutForm() {
  const { id, planId } = useParams()
  const [params] = useSearchParams()
  const clientId = params.get('clientId')
  const navigate = useNavigate()
  const qc = useQueryClient()

  const isEdit = !!id
  const workoutId = id ? Number(id) : null

  const [scheduledDate, setScheduledDate] = useState('')
  const [duration, setDuration] = useState('')

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
      setScheduledDate(toDateTimeLocal(workout.scheduled_date))
      setDuration(workout.duration_minutes ? String(workout.duration_minutes) : '')
    }
  }, [workout])

  const backTo = clientId ? `/trainer/clients/${clientId}` : '/trainer/clients'

  const createMut = useMutation({
    mutationFn: () =>
      workoutApi.create(Number(planId), {
        scheduled_date: fromDateTimeLocal(scheduledDate) ?? '',
        duration_minutes: duration ? Number(duration) : null,
      }),
    onSuccess: (w) => {
      toast.success('Тренировка создана — добавьте упражнения')
      qc.invalidateQueries({ queryKey: ['plan-workouts'] })
      navigate(`/trainer/workouts/${w.workout_id}/edit?clientId=${clientId ?? ''}`, { replace: true })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const patchMut = useMutation({
    mutationFn: () =>
      workoutApi.patch(workoutId!, {
        scheduled_date: fromDateTimeLocal(scheduledDate) ?? undefined,
        duration_minutes: duration ? Number(duration) : null,
      }),
    onSuccess: () => {
      toast.success('Сохранено. Клиент уведомлён о тренировке.')
      qc.invalidateQueries({ queryKey: ['workout', workoutId] })
      qc.invalidateQueries({ queryKey: ['plan-workouts'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const [pickerOpen, setPickerOpen] = useState(false)

  if (isEdit && lw) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={isEdit ? 'Тренировка' : 'Новая тренировка'} back={backTo} />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field label="Дата и время" table="workouts" attr="scheduled_date">
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </Field>
          <Field label="Длительность, мин" table="workouts" attr="duration_minutes">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
            />
          </Field>
        </CardBody>
      </Card>

      {!isEdit ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">Сначала сохраните тренировку, затем добавьте упражнения.</p>
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!scheduledDate}>
            Создать
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between">
            <h3>Упражнения</h3>
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" /> Добавить
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {(exercises ?? []).length === 0 ? (
              <EmptyState title="Упражнений ещё нет" />
            ) : (
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
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Готово
            </Button>
            <Button onClick={() => patchMut.mutate()} loading={patchMut.isPending}>
              Сохранить и уведомить
            </Button>
          </div>

          <AddExerciseModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            workoutId={workoutId!}
            nextOrder={(exercises ?? []).length}
          />
        </>
      )}
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
  open, onClose, workoutId, nextOrder,
}: {
  open: boolean; onClose: () => void; workoutId: number; nextOrder: number
}) {
  const qc = useQueryClient()
  const { data: catalogue } = useQuery({ queryKey: ['exercises'], queryFn: exerciseApi.list, enabled: open })
  const [exerciseId, setExerciseId] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('')

  const add = useMutation({
    mutationFn: () =>
      workoutExerciseApi.add(workoutId, {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить упражнение"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!exerciseId}>
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
