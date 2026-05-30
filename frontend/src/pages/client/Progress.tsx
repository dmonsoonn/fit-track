import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Card, CardBody, EmptyState, PageLoader, StatCard } from '@/components/ui'
import { clientApi } from '@/api'
import { dateParts } from '@/lib/format'

export default function Progress() {
  const { data: workouts, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: clientApi.schedule,
  })

  const stats = useMemo(() => {
    const list = workouts ?? []
    return {
      total: list.length,
      completed: list.filter((w) => w.status === 'completed').length,
      skipped: list.filter((w) => w.status === 'skipped').length,
      planned: list.filter((w) => w.status === 'planned').length,
    }
  }, [workouts])

  // Completed workouts grouped by ISO week for a small bar chart.
  const weekly = useMemo(() => {
    const completed = (workouts ?? []).filter((w) => w.status === 'completed')
    const buckets = new Map<string, number>()
    for (const w of completed) {
      const d = new Date(w.scheduled_date)
      const key = `${d.getFullYear()}-${weekOf(d)}`
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const entries = [...buckets.entries()].slice(-8)
    const max = Math.max(1, ...entries.map(([, v]) => v))
    return { entries, max }
  }, [workouts])

  if (isLoading) return <PageLoader />

  const recent = (workouts ?? [])
    .filter((w) => w.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
    .slice(0, 8)

  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Прогресс" subtitle="Статистика ваших тренировок" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard value={stats.total} label="всего" />
        <StatCard value={stats.completed} label="завершено" />
        <StatCard value={stats.planned} label="предстоит" />
        <StatCard value={`${completionRate}%`} label="выполнение" />
      </div>

      <Card className="mt-4">
        <CardBody>
          <h2 className="mb-4">Завершённые тренировки по неделям</h2>
          {weekly.entries.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Пока нет завершённых тренировок" />
          ) : (
            <div className="flex h-40 items-end gap-2">
              {weekly.entries.map(([key, value]) => (
                <div key={key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-ink">{value}</span>
                  <div
                    className="w-full rounded-t bg-success/80"
                    style={{ height: `${(value / weekly.max) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted">нед. {key.split('-')[1]}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {recent.length > 0 && (
        <Card className="mt-4">
          <CardBody>
            <h2 className="mb-3">Последние тренировки</h2>
            <ul className="divide-y divide-line">
              {recent.map((w) => {
                const { day, month } = dateParts(w.scheduled_date)
                return (
                  <li key={w.workout_id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-ink">
                      {day} {month}
                    </span>
                    <span className="text-sm text-success">Завершена</span>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function weekOf(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d.getTime() - start.getTime()) / 86_400_000
  return Math.ceil((diff + start.getDay() + 1) / 7)
}
