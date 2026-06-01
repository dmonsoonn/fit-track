import { create } from 'zustand'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, message: string) => void
  remove: (id: number) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const TONES = {
  success: 'border-success/30 text-success',
  error: 'border-danger/30 text-danger',
  info: 'border-info/30 text-info',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)
  return (
    <div className="fixed bottom-6 right-4 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={`flex w-full max-w-sm items-center gap-2 rounded-card border bg-card px-4 py-3 text-left text-sm shadow-pop ${TONES[t.kind]}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-ink">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
