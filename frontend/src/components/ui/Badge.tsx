import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { WorkoutStatus } from '@/types'
import { STATUS_LABEL } from '@/lib/format'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const TONES: Record<Tone, string> = {
  neutral: 'bg-page text-muted',
  success: 'bg-success-bg text-success',
  warning: 'bg-warn-bg text-warn-ink',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-primary-50 text-info',
  primary: 'bg-primary-50 text-primary',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<WorkoutStatus, Tone> = {
  planned: 'warning',
  completed: 'success',
  skipped: 'danger',
}

export function StatusBadge({ status }: { status: WorkoutStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}
