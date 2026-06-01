import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pencil, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Button, Card, ConfirmDialog, DateTimeInput, Field, Input, Modal, PageLoader, StatCard, toast } from '@/components/ui'
import { foodApi, type FoodEntryPayload } from '@/api'
import { apiError } from '@/api/client'
import { formatLongDate, formatTime, fromDateTimeLocal, toISODate } from '@/lib/format'
import type { FoodEntry } from '@/types'

const EMPTY: FoodEntryPayload = {
  title: '',
  description: '',
  calories: null,
  protein: null,
  fat: null,
  carbs: null,
  meal_time: null,
}

export default function FoodDiary() {
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date())
  const iso = toISODate(date)
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FoodEntryPayload>(EMPTY)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: log, isLoading } = useQuery({
    queryKey: ['food-log', iso],
    queryFn: () => foodApi.log(iso),
  })

  const shiftDay = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  const totals = useMemo(() => {
    const e = log?.entries ?? []
    return {
      cal: e.reduce((s, x) => s + (x.calories ?? 0), 0),
      p: e.reduce((s, x) => s + (x.protein ?? 0), 0),
      f: e.reduce((s, x) => s + (x.fat ?? 0), 0),
      c: e.reduce((s, x) => s + (x.carbs ?? 0), 0),
    }
  }, [log])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, meal_time: fromDateTimeLocal(form.meal_time) }
      return editing ? foodApi.patchEntry(editing.food_entry_id, payload) : foodApi.addEntry(iso, payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Запись обновлена' : 'Запись добавлена')
      qc.invalidateQueries({ queryKey: ['food-log', iso] })
      setOpen(false)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => foodApi.deleteEntry(id),
    onSuccess: () => {
      toast.success('Запись удалена')
      qc.invalidateQueries({ queryKey: ['food-log', iso] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (entry: FoodEntry) => {
    setEditing(entry)
    setForm({
      title: entry.title,
      description: entry.description,
      calories: entry.calories,
      protein: entry.protein,
      fat: entry.fat,
      carbs: entry.carbs,
      meal_time: entry.meal_time,
    })
    setOpen(true)
  }

  const num = (v: string) => (v === '' ? null : Number(v))

  const validateEntry = (): boolean => {
    if (!form.title.trim()) { toast.error('Введите название блюда'); return false }
    if (form.calories != null && form.calories < 0) { toast.error('Калории не могут быть отрицательными'); return false }
    if (form.protein != null && form.protein < 0) { toast.error('Белки не могут быть отрицательными'); return false }
    if (form.fat != null && form.fat < 0) { toast.error('Жиры не могут быть отрицательными'); return false }
    if (form.carbs != null && form.carbs < 0) { toast.error('Углеводы не могут быть отрицательными'); return false }
    return true
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Дневник питания" />

      <Card className="mb-4 flex items-center justify-between p-2">
        <button onClick={() => shiftDay(-1)} className="rounded-full p-2 text-muted hover:bg-page">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold">{formatLongDate(date)}</span>
        <button onClick={() => shiftDay(1)} className="rounded-full p-2 text-muted hover:bg-page">
          <ChevronRight className="h-5 w-5" />
        </button>
      </Card>

      <p className="mb-2 text-sm font-medium text-ink">Сводка за день</p>
      <div className="mb-4 grid grid-cols-4 gap-2">
        <StatCard value={totals.cal} label="ккал" />
        <StatCard value={Math.round(totals.p)} label="белки" />
        <StatCard value={Math.round(totals.f)} label="жиры" />
        <StatCard value={Math.round(totals.c)} label="угл." />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="flex flex-col gap-3">
          {(log?.entries ?? []).map((entry) => (
            <Card key={entry.food_entry_id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {entry.meal_time && (
                    <p className="text-xs font-semibold text-muted">{formatTime(entry.meal_time)}</p>
                  )}
                  <p className="font-semibold text-ink">{entry.title}</p>
                  {entry.description && <p className="text-sm text-muted">{entry.description}</p>}
                  <p className="mt-1 text-sm text-ink">
                    {entry.calories ?? 0} ккал · Б:{Math.round(entry.protein ?? 0)} Ж:
                    {Math.round(entry.fat ?? 0)} У:{Math.round(entry.carbs ?? 0)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(entry)}
                    className="rounded-full p-1.5 text-muted hover:bg-page"
                    aria-label="Редактировать"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(entry.food_entry_id)}
                    className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                    aria-label="Удалить"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          <Button variant="outline" fullWidth onClick={openAdd}>
            <Plus className="h-4 w-4" /> Добавить приём пищи
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteMutation.mutate(deleteId!); setDeleteId(null) }}
        title="Удалить запись?"
        confirmLabel="Удалить"
        destructive
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Редактировать запись' : 'Новый приём пищи'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отменить
            </Button>
            <Button
              onClick={() => { if (validateEntry()) saveMutation.mutate() }}
              loading={saveMutation.isPending}
            >
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Название блюда" table="food_entries" attr="title">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Овсяная каша с бананом"
            />
          </Field>
          <Field label="Описание" table="food_entries" attr="description">
            <Input
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Каша 250г + банан 120г"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Калории" table="food_entries" attr="calories">
              <Input
                type="number"
                value={form.calories ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, calories: num(e.target.value) }))}
              />
            </Field>
            <Field label="Дата и время" table="food_entries" attr="meal_time">
              <DateTimeInput
                value={form.meal_time}
                onChange={(v) => setForm((f) => ({ ...f, meal_time: v }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Белки, г" table="food_entries" attr="protein">
              <Input
                type="number"
                step="0.1"
                value={form.protein ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, protein: num(e.target.value) }))}
              />
            </Field>
            <Field label="Жиры, г" table="food_entries" attr="fat">
              <Input
                type="number"
                step="0.1"
                value={form.fat ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, fat: num(e.target.value) }))}
              />
            </Field>
            <Field label="Угл., г" table="food_entries" attr="carbs">
              <Input
                type="number"
                step="0.1"
                value={form.carbs ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, carbs: num(e.target.value) }))}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
