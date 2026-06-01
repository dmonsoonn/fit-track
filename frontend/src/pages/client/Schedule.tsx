import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, ChipGroup, Chip, EmptyState, PageLoader, StatusBadge } from '@/components/ui'
import { clientApi } from '@/api'
import { dateParts, formatTime } from '@/lib/format'
import type { Workout } from '@/types'

type Filter = 'all' | 'upcoming' | 'done'

export default function Schedule() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: workouts, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: clientApi.schedule,
  })
  const { data: plan } = useQuery({
    queryKey: ['my-active-plan'],
    queryFn: clientApi.myActivePlan,
    retry: false,
  })

  const filtered = useMemo(() => {
    const list = workouts ?? []
    const sorted = [...list].sort(
      (a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime(),
    )
    if (filter === 'upcoming') return sorted.filter((w) => w.status === 'planned')
    if (filter === 'done') return sorted.filter((w) => w.status !== 'planned')
    return sorted
  }, [workouts, filter])

  if (isLoading) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Расписание"
        subtitle={plan ? `Программа: ${plan.title}` : 'Активная программа не назначена'}
      />

      <ChipGroup>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          Все
        </Chip>
        <Chip active={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>
          Предстоящие
        </Chip>
        <Chip active={filter === 'done'} onClick={() => setFilter('done')}>
          Завершённые
        </Chip>
      </ChipGroup>

      <div className="mt-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Тренировок нет"
            description="Здесь появятся тренировки, назначенные вашим тренером."
          />
        ) : (
          filtered.map((w) => (
            <WorkoutCard key={w.workout_id} workout={w} onOpen={() => navigate(`/workout/${w.workout_id}`)} />
          ))
        )}
      </div>
    </div>
  )
}

function WorkoutCard({ workout, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { day, month, weekday } = dateParts(workout.scheduled_date)
  const meta = [formatTime(workout.scheduled_date), workout.duration_minutes && `${workout.duration_minutes} мин`]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card
      className="flex cursor-pointer items-center gap-4 p-4 transition-shadow hover:shadow-pop"
      onClick={onOpen}
    >
      <div className="flex w-14 shrink-0 flex-col items-center rounded-card bg-primary-50 py-2 text-primary">
        <span className="text-xl font-bold leading-none">{day}</span>
        <span className="text-xs">{month}</span>
        <span className="text-[11px] text-muted">{weekday}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Тренировка</p>
        <p className="text-sm text-muted">{meta || '—'}</p>
        <div className="mt-1.5">
          <StatusBadge status={workout.status} />
        </div>
      </div>
      <Button
        size="sm"
        variant={workout.status === 'planned' ? 'primary' : 'outline'}
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
      >
        {workout.status === 'planned' ? 'Начать' : 'Результаты'}
      </Button>
    </Card>
  )
}
