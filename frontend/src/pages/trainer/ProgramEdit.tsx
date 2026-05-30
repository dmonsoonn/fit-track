import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, EmptyState, Field, Input, PageLoader, StatusBadge, Textarea, toast } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { planApi, workoutApi } from '@/api'
import { apiError } from '@/api/client'
import { dateParts, formatShortDate, formatTime, toISODate } from '@/lib/format'

export default function ProgramEdit() {
  const { id, planId } = useParams()
  const clientId = Number(id)
  const planIdNum = Number(planId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', clientId, planIdNum],
    queryFn: () => planApi.get(clientId, planIdNum),
  })
  const { data: workouts } = useQuery({
    queryKey: ['plan-workouts', planIdNum],
    queryFn: () => workoutApi.listByPlan(planIdNum),
  })

  const [form, setForm] = useState({ title: '', description: '', end_date: '', is_active: true })

  useEffect(() => {
    if (plan) {
      setForm({
        title: plan.title,
        description: plan.description ?? '',
        end_date: plan.end_date ? toISODate(new Date(plan.end_date)) : '',
        is_active: plan.is_active,
      })
    }
  }, [plan])

  const save = useMutation({
    mutationFn: () =>
      planApi.patch(clientId, planIdNum, {
        title: form.title,
        description: form.description || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      toast.success('Программа сохранена')
      qc.invalidateQueries({ queryKey: ['plan', clientId, planIdNum] })
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const remove = useMutation({
    mutationFn: () => planApi.remove(clientId, planIdNum),
    onSuccess: () => {
      toast.success('Программа удалена')
      qc.invalidateQueries({ queryKey: ['client-plans', clientId] })
      navigate(`/trainer/clients/${clientId}`)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading || !plan) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Редактирование программы"
        subtitle={`Создана: ${formatShortDate(plan.created_at)}`}
        back={`/trainer/clients/${clientId}`}
      />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2>Основные параметры</h2>
          <Field label="Название программы" table="workout_plans" attr="title">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Описание" table="workout_plans" attr="description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <Field label="Дата окончания" table="workout_plans" attr="end_date">
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </Field>
          <Field label="Статус" table="workout_plans" attr="is_active">
            <div className="grid grid-cols-2 gap-3">
              <Chip active={form.is_active} onClick={() => setForm((f) => ({ ...f, is_active: true }))} className="justify-center">
                Активная
              </Chip>
              <Chip active={!form.is_active} onClick={() => setForm((f) => ({ ...f, is_active: false }))} className="justify-center">
                Завершена
              </Chip>
            </div>
          </Field>
        </CardBody>
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <h3>Тренировки в программе</h3>
        <Button
          size="sm"
          onClick={() => navigate(`/trainer/plans/${planIdNum}/workouts/new?clientId=${clientId}`)}
        >
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {(workouts ?? []).length === 0 ? (
          <EmptyState title="Тренировок ещё нет" />
        ) : (
          (workouts ?? [])
            .slice()
            .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
            .map((w) => {
              const { day, month } = dateParts(w.scheduled_date)
              return (
                <Card
                  key={w.workout_id}
                  className="flex cursor-pointer items-center gap-3 p-3 hover:shadow-pop"
                  onClick={() => navigate(`/trainer/workouts/${w.workout_id}/edit?clientId=${clientId}`)}
                >
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-card bg-primary-50 py-1.5 text-primary">
                    <span className="font-bold leading-none">{day}</span>
                    <span className="text-[10px]">{month}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {formatTime(w.scheduled_date)}
                      {w.duration_minutes ? ` · ${w.duration_minutes} мин` : ''}
                    </p>
                    <StatusBadge status={w.status} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Card>
              )
            })
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" className="text-danger" onClick={() => remove.mutate()} loading={remove.isPending}>
          <Trash2 className="h-4 w-4" /> Удалить программу
        </Button>
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Сохранить
        </Button>
      </div>
    </div>
  )
}
