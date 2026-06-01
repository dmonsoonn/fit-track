import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Avatar, Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, Field, Input, Modal, PageLoader, StatusBadge, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { planApi, trainerApi, workoutApi, workoutExerciseApi } from '@/api'
import { apiError } from '@/api/client'
import { fullName, initials, LEVEL_LABEL, formatShortDate, formatTime, dateParts, formatLongDate, toISODate } from '@/lib/format'
import type { Workout, WorkoutPlan } from '@/types'

type Tab = 'profile' | 'program' | 'results' | 'nutrition'
const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Профиль' },
  { key: 'program', label: 'Программа' },
  { key: 'results', label: 'Результаты' },
  { key: 'nutrition', label: 'Питание' },
]

export default function ClientDetail() {
  const { id } = useParams()
  const clientId = Number(id)
  const location = useLocation()
  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab } | null)?.tab ?? 'profile')

  const { data: client, isLoading } = useQuery({
    queryKey: ['trainer-client', clientId],
    queryFn: () => trainerApi.client(clientId),
  })

  if (isLoading || !client) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={fullName(client.first_name, client.last_name)} subtitle={client.email} back="/trainer/clients" />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.key ? 'text-primary' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary" />}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab client={client} />}
      {tab === 'program' && <ProgramTab clientId={clientId} />}
      {tab === 'results' && <ResultsTab clientId={clientId} />}
      {tab === 'nutrition' && <NutritionTab clientId={clientId} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value || '—'}</span>
    </div>
  )
}

function ProfileTab({ client }: { client: import('@/types').Client }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <Avatar text={initials(client.first_name, client.last_name)} size="lg" />
          <div>
            <p className="text-lg font-semibold">{fullName(client.first_name, client.last_name)}</p>
            {client.level && <Badge tone="primary">{LEVEL_LABEL[client.level]}</Badge>}
          </div>
        </div>
        <div className="divide-y divide-line">
          <Row label="Цель тренировок" value={client.goal} />
          <Row label="Вес" value={client.weight ? `${client.weight} кг` : ''} />
          <Row label="Рост" value={client.height ? `${client.height} см` : ''} />
          <Row label="Дата рождения" value={formatShortDate(client.date_of_birth)} />
          <Row label="Ограничения по здоровью" value={client.health_notes} />
        </div>
      </CardBody>
    </Card>
  )
}

function ProgramTab({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const navigate = useNavigate()

  const { data: plans, isLoading } = useQuery({
    queryKey: ['client-plans', clientId],
    queryFn: () => planApi.list(clientId),
  })

  const create = useMutation({
    mutationFn: () => planApi.create(clientId, { title, is_active: false }),
    onSuccess: (plan) => {
      toast.success('Программа создана')
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
      setOpen(false)
      setTitle('')
      navigate(`/trainer/clients/${clientId}/plans/${plan.workout_plan_id}`)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading) return <PageLoader />

  const sorted = [...(plans ?? [])].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Создать программу
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="Программ нет"
          description="Создайте тренировочную программу для этого клиента."
        />
      ) : (
        sorted.map((p) => (
          <ProgramCard key={p.workout_plan_id} plan={p} clientId={clientId} />
        ))
      )}

      <CreatePlanModal
        open={open}
        onClose={() => { setOpen(false); setTitle('') }}
        title={title}
        setTitle={setTitle}
        onCreate={() => create.mutate()}
        loading={create.isPending}
      />
    </div>
  )
}

function ProgramCard({ plan, clientId }: { plan: WorkoutPlan; clientId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const activate = useMutation({
    mutationFn: () => planApi.patch(clientId, plan.workout_plan_id, { is_active: true }),
    onSuccess: () => {
      toast.success('Программа назначена активной')
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const complete = useMutation({
    mutationFn: () => planApi.patch(clientId, plan.workout_plan_id, { is_active: false }),
    onSuccess: () => {
      toast.success('Программа завершена')
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const remove = useMutation({
    mutationFn: () => planApi.remove(clientId, plan.workout_plan_id),
    onSuccess: () => {
      toast.success('Программа удалена')
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3>{plan.title}</h3>
              {plan.is_active && <Badge tone="success">Активная</Badge>}
            </div>
            {plan.description && <p className="mt-1 text-sm text-muted">{plan.description}</p>}
            {plan.end_date && (
              <p className="mt-1 text-xs text-muted">До {formatShortDate(plan.end_date)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.is_active ? (
            <Button variant="outline" size="sm" onClick={() => complete.mutate()} loading={complete.isPending}>
              Завершить
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => activate.mutate()} loading={activate.isPending}>
                Назначить активной
              </Button>
              <button
                onClick={() => setDeleteOpen(true)}
                disabled={remove.isPending}
                className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger disabled:opacity-50"
                aria-label="Удалить программу"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/trainer/clients/${clientId}/plans/${plan.workout_plan_id}`)}
          >
            <Pencil className="h-4 w-4" /> Изменить
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { remove.mutate(); setDeleteOpen(false) }}
        title="Удалить программу?"
        message="Все тренировки в программе будут удалены. Это действие нельзя отменить."
        confirmLabel="Удалить"
        destructive
      />
    </Card>
  )
}

function CreatePlanModal({
  open, onClose, title, setTitle, onCreate, loading,
}: {
  open: boolean; onClose: () => void; title: string; setTitle: (v: string) => void; onCreate: () => void; loading: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая программа"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button onClick={onCreate} loading={loading} disabled={!title.trim()}>Создать</Button>
        </div>
      }
    >
      <Field label="Название программы" table="workout_plans" attr="title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Набор массы — фаза 1" />
      </Field>
    </Modal>
  )
}

function ResultsTab({ clientId }: { clientId: number }) {
  const { data: plans } = useQuery({ queryKey: ['client-plans', clientId], queryFn: () => planApi.list(clientId) })
  const active = plans?.find((p) => p.is_active) ?? plans?.[0]
  const { data: workouts, isLoading } = useQuery({
    queryKey: ['plan-workouts', active?.workout_plan_id],
    queryFn: () => workoutApi.listByPlan(active!.workout_plan_id),
    enabled: !!active,
  })

  if (!active) return <EmptyState title="Нет данных о тренировках" />
  if (isLoading) return <PageLoader />

  const completed = (workouts ?? []).filter((w) => w.status === 'completed')
  if (completed.length === 0) return <EmptyState title="Завершённых тренировок пока нет" />

  return (
    <div className="flex flex-col gap-3">
      {completed
        .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
        .map((w) => <ResultRow key={w.workout_id} workout={w} />)}
    </div>
  )
}

function ResultRow({ workout }: { workout: Workout }) {
  const [open, setOpen] = useState(false)
  const { data: results } = useQuery({
    queryKey: ['workout-results', workout.workout_id],
    queryFn: () => workoutExerciseApi.results(workout.workout_id),
    enabled: open,
  })
  const { data: exercises } = useQuery({
    queryKey: ['workout-exercises', workout.workout_id],
    queryFn: () => workoutExerciseApi.list(workout.workout_id),
    enabled: open,
  })
  const nameById = new Map((exercises ?? []).map((e) => [e.workout_exercise_id, e.exercise_name]))

  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <div>
          <p className="font-medium">{formatLongDate(workout.scheduled_date)}</p>
          <StatusBadge status={workout.status} />
        </div>
        <ChevronRight className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="border-t border-line px-4 py-3">
          {(results ?? []).length === 0 ? (
            <p className="text-sm text-muted">Результаты не зафиксированы.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(results ?? []).map((r) => (
                <li key={r.result_id} className="text-sm">
                  <span className="font-medium text-ink">{nameById.get(r.workout_exercise_id) ?? 'Упражнение'}</span>
                  <span className="text-muted">
                    {' '}— {r.actual_sets ?? '—'}×{r.actual_reps ?? '—'} · {r.actual_weight ?? '—'} кг
                  </span>
                  {r.client_comment && <p className="text-xs text-muted">💬 {r.client_comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

function NutritionTab({ clientId }: { clientId: number }) {
  const [date, setDate] = useState(new Date())
  const iso = toISODate(date)
  const { data: log, isLoading } = useQuery({
    queryKey: ['client-food-log', clientId, iso],
    queryFn: () => trainerApi.clientFoodLog(clientId, iso),
  })
  const shift = (d: number) => {
    const nd = new Date(date)
    nd.setDate(nd.getDate() + d)
    setDate(nd)
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-center justify-between p-2">
        <button onClick={() => shift(-1)} className="rounded-full p-2 text-muted hover:bg-page"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold">{formatLongDate(date)}</span>
        <button onClick={() => shift(1)} className="rounded-full p-2 text-muted hover:bg-page"><ChevronRight className="h-5 w-5" /></button>
      </Card>
      {isLoading ? (
        <PageLoader />
      ) : (log?.entries ?? []).length === 0 ? (
        <EmptyState title="Записей за этот день нет" />
      ) : (
        (log?.entries ?? []).map((e) => (
          <Card key={e.food_entry_id} className="p-4">
            {e.meal_time && <p className="text-xs font-semibold text-muted">{formatTime(e.meal_time)}</p>}
            <p className="font-semibold">{e.title}</p>
            {e.description && <p className="text-sm text-muted">{e.description}</p>}
            <p className="mt-1 text-sm">
              {e.calories ?? 0} ккал · Б:{Math.round(e.protein ?? 0)} Ж:{Math.round(e.fat ?? 0)} У:{Math.round(e.carbs ?? 0)}
            </p>
          </Card>
        ))
      )}
    </div>
  )
}
