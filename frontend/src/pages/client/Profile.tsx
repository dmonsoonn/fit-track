import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, CardBody, Field, Input, PageLoader, toast } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { clientApi } from '@/api'
import { apiError } from '@/api/client'
import { LEVEL_LABEL, toISODate } from '@/lib/format'
import type { ClientProfilePatch, FitnessLevel } from '@/types'

const LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced']

export default function ClientProfile() {
  const qc = useQueryClient()
  const { data: client, isLoading } = useQuery({ queryKey: ['client-me'], queryFn: clientApi.me })

  const [form, setForm] = useState<ClientProfilePatch>({})

  useEffect(() => {
    if (client) {
      setForm({
        first_name: client.first_name,
        last_name: client.last_name,
        goal: client.goal,
        weight: client.weight,
        height: client.height,
        level: client.level,
        health_notes: client.health_notes,
        date_of_birth: client.date_of_birth ? toISODate(new Date(client.date_of_birth)) : null,
      })
    }
  }, [client])

  const mutation = useMutation({
    mutationFn: () => clientApi.patchMe(form),
    onSuccess: () => {
      toast.success('Профиль сохранён')
      qc.invalidateQueries({ queryKey: ['client-me'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading || !client) return <PageLoader />

  const num = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Личный кабинет" subtitle={client.email} />

      <Card>
        <CardBody className="flex flex-col gap-5">
          <h2>Личные данные</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя" table="users" attr="first_name">
              <Input
                value={form.first_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </Field>
            <Field label="Фамилия" table="users" attr="last_name">
              <Input
                value={form.last_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Дата рождения" table="clients" attr="date_of_birth">
            <Input
              type="date"
              value={form.date_of_birth ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value || null }))}
            />
          </Field>

          <Field label="Цель тренировок" table="clients" attr="goal">
            <Input
              placeholder="Например, набор мышечной массы"
              value={form.goal ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            />
          </Field>

          <h2 className="mt-2">Параметры тренировок</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Вес, кг" table="clients" attr="weight">
              <Input
                type="number"
                step="0.1"
                value={form.weight ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, weight: num(e.target.value) }))}
              />
            </Field>
            <Field label="Рост, см" table="clients" attr="height">
              <Input
                type="number"
                step="0.1"
                value={form.height ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, height: num(e.target.value) }))}
              />
            </Field>
          </div>

          <Field label="Уровень подготовки" table="clients" attr="level">
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((lvl) => (
                <Chip
                  key={lvl}
                  active={form.level === lvl}
                  onClick={() => setForm((f) => ({ ...f, level: lvl }))}
                  className="justify-center text-center"
                >
                  {LEVEL_LABEL[lvl]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Ограничения по здоровью" table="clients" attr="health_notes">
            <Input
              placeholder="Травмы, противопоказания…"
              value={form.health_notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, health_notes: e.target.value }))}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => client && setForm({ ...client })}>
              Отменить
            </Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
              Сохранить
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
