import type { ReactNode } from 'react'
import { Dumbbell } from 'lucide-react'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
            <Dumbbell className="h-8 w-8" />
          </span>
          <h1 className="mt-3">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-card border border-line bg-card p-6 shadow-card">{children}</div>
      </div>
    </div>
  )
}
