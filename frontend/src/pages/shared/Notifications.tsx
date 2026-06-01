import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, CheckCircle2, Dumbbell, MessageSquare, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, ConfirmDialog, EmptyState, PageLoader, toast } from '@/components/ui'
import { notificationApi } from '@/api'
import { apiError } from '@/api/client'
import { formatLongDate, formatTime } from '@/lib/format'
import type { NotificationType } from '@/types'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'

const ICON: Record<NotificationType, typeof Bell> = {
  workout_assigned: Dumbbell,
  workout_completed: CheckCircle2,
  message: MessageSquare,
}

const TYPE_LABEL: Record<NotificationType, string> = {
  workout_assigned: 'Новая тренировка',
  workout_completed: 'Тренировка завершена',
  message: 'Сообщение',
}

const FROM_PREFIX: Record<NotificationType, string> = {
  workout_assigned: 'от тренера',
  workout_completed: 'от клиента',
  message: 'от тренера',
}

export default function Notifications() {
  const qc = useQueryClient()
  const setUnreadCount = useAuthStore((s) => s.setUnreadCount)
  const [clearAllOpen, setClearAllOpen] = useState(false)

  // Reset badge counter immediately when user opens this page
  useEffect(() => { setUnreadCount(0) }, [setUnreadCount])

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
  const deleteOne = useMutation({
    mutationFn: (id: number) => notificationApi.deleteOne(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (e) => toast.error(apiError(e)),
  })
  const deleteAll = useMutation({
    mutationFn: () => notificationApi.deleteAll(),
    onSuccess: () => {
      toast.success('Все уведомления удалены')
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setClearAllOpen(false)
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
          list.length > 0 && (
            <div className="flex gap-2">
              {hasUnread && (
                <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
                  <CheckCheck className="h-4 w-4" /> Прочитать все
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setClearAllOpen(true)}>
                <Trash2 className="h-4 w-4" /> Очистить
              </Button>
            </div>
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
                  <p className="text-sm font-semibold text-ink">{TYPE_LABEL[n.type] ?? n.type}</p>
                  <p className="text-sm text-muted">{n.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {FROM_PREFIX[n.type]}{n.sender_name ? ` ${n.sender_name}` : ''} · {formatLongDate(n.created_at)} · {formatTime(n.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.is_read && (
                    <button
                      onClick={() => markRead.mutate(n.notification_id)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Прочитать
                    </button>
                  )}
                  <button
                    onClick={() => deleteOne.mutate(n.notification_id)}
                    className="rounded-full p-1 text-muted hover:bg-danger-bg hover:text-danger"
                    aria-label="Удалить уведомление"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={clearAllOpen}
        onClose={() => setClearAllOpen(false)}
        onConfirm={() => deleteAll.mutate()}
        title="Очистить все уведомления?"
        message="Все уведомления будут удалены без возможности восстановления."
        confirmLabel="Очистить"
        destructive
      />
    </div>
  )
}
