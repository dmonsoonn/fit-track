import { cn } from '@/lib/cn'

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  className,
}: {
  value: number
  max?: number
  tone?: 'primary' | 'success'
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <div
        className={cn('h-full rounded-full transition-all', tone === 'success' ? 'bg-success' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
