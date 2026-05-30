import { cn } from '@/lib/cn'

export function StatCard({
  value,
  label,
  className,
}: {
  value: string | number
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-line bg-card px-3 py-3 text-center',
        className,
      )}
    >
      <span className="text-xl font-bold text-ink">{value}</span>
      <span className="mt-0.5 text-xs text-muted">{label}</span>
    </div>
  )
}
