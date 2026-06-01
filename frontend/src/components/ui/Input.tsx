import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const fieldBase =
  'w-full rounded-input border border-line bg-white px-3 text-ink placeholder:text-muted/40 ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-page disabled:text-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'py-2.5 min-h-[80px] max-h-[160px] resize-y', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, InputHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, 'h-11 appearance-none', className)} {...rest}>
        {children}
      </select>
    )
  },
)
