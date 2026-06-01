import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Подтвердить',
  destructive = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button
            onClick={onConfirm}
            variant={destructive ? 'ghost' : undefined}
            className={destructive ? 'text-danger hover:bg-danger-bg' : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {message && <p className="text-sm text-muted">{message}</p>}
    </Modal>
  )
}
