import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, CheckCircle2, Dumbbell, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, EmptyState, PageLoader, toast } from '@/components/ui'
import { notificationApi } from '@/api'
import { apiError } from '@/api/client'
import { formatLongDate, formatTime } from '@/lib/format'
import type { NotificationType } from '@/types'
import { cn } from '@/lib/cn'

const ICON: Record<NotificationType, typeof Bell> = {
  workout_assigned: Dumbbell,
  workout_completed: CheckCircle2,
  message: MessageSquare,
}

export default function Notifications() {
  const qc = useQueryClient()
  const { data: items, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      toast.success('Все уведомления прочитаны')
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading) return <PageLoader />

  const list = items ?? []
  const hasUnread = list.some((n) => !n.is_read)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Уведомления"
        actions={
          hasUnread && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck className="h-4 w-4" /> Прочитать все
            </Button>
          )
        }
      />

      {list.length === 0 ? (
        <EmptyState icon={Bell} title="Уведомлений нет" description="Здесь появятся новые события." />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((n) => {
            const Icon = ICON[n.type] ?? Bell
            return (
              <Card
                key={n.notification_id}
                className={cn(
                  'flex items-start gap-3 p-4 transition-colors',
                  !n.is_read && 'border-primary/30 bg-primary-50/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    n.is_read ? 'bg-page text-muted' : 'bg-primary text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{n.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatLongDate(n.created_at)} · {formatTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead.mutate(n.notification_id)}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Прочитать
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
