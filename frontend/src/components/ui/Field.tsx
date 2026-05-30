import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FieldProps {
  label?: string
  /** DB annotation from the drawio, e.g. table="users" attr="email" */
  table?: string
  attr?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/** Labelled form-field wrapper that surfaces the DB annotation for traceability. */
export function Field({ label, table, attr, hint, error, required, className, children }: FieldProps) {
  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      data-table={table}
      data-attr={attr}
    >
      {label && (
        <label className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
      {import.meta.env.DEV && table && attr && (
        <span className="dev-hint">
          {table}.{attr}
        </span>
      )}
    </div>
  )
}
