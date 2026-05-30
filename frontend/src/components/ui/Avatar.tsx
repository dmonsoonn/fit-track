import { cn } from '@/lib/cn'

export function Avatar({
  text,
  size = 'md',
  className,
}: {
  text: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-xl',
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white',
        sizes[size],
        className,
      )}
    >
      {text}
    </div>
  )
}
