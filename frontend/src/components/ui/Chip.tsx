import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Segmented-control / filter chip. Active state uses primary. */
export function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active?: boolean
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-primary text-white'
          : 'border border-line bg-white text-muted hover:bg-page',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}
