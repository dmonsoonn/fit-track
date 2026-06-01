import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, ConfirmDialog, Field, Input, PageLoader, toast } from '@/components/ui'
import { trainerApi } from '@/api'
import { apiError } from '@/api/client'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'

export default function TrainerProfile() {
  const qc = useQueryClient()
  const { data: trainer, isLoading } = useQuery({ queryKey: ['trainer-me'], queryFn: trainerApi.me })
  const [spec, setSpec] = useState('')
  const { setDirty, blocker } = useUnsavedGuard()

  useEffect(() => {
    if (trainer) setSpec(trainer.specialization ?? '')
  }, [trainer])

  const save = useMutation({
    mutationFn: () => trainerApi.patchMe({ specialization: spec }),
    onSuccess: () => {
      toast.success('Профиль сохранён')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['trainer-me'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const copyCode = () => {
    if (!trainer) return
    navigator.clipboard.writeText(trainer.invite_code)
    toast.success('Код скопирован')
  }

  if (isLoading || !trainer) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Профиль тренера" subtitle={trainer.email} />

      <Card>
        <CardBody className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя" table="users" attr="first_name">
              <Input value={trainer.first_name} disabled />
            </Field>
            <Field label="Фамилия" table="users" attr="last_name">
              <Input value={trainer.last_name} disabled />
            </Field>
          </div>

          <Field label="Специализация" table="trainers" attr="specialization">
            <Input
              value={spec}
              onChange={(e) => { setDirty(true); setSpec(e.target.value) }}
              placeholder="Например, силовые тренировки, реабилитация"
            />
          </Field>

          <Field label="Код приглашения" table="trainers" attr="invite_code" hint="Передайте этот код клиентам для регистрации">
            <div className="flex gap-2">
              <Input value={trainer.invite_code} readOnly className="font-mono tracking-widest" />
              <Button variant="outline" onClick={copyCode}>
                <Copy className="h-4 w-4" /> Копировать
              </Button>
            </div>
          </Field>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Сохранить
            </Button>
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Несохранённые изменения"
        message="Изменения будут потеряны. Продолжить?"
        confirmLabel="Уйти"
      />
    </div>
  )
}
