import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Pencil, Plus, Trash2, Upload, Video } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Textarea, toast } from '@/components/ui'
import { exerciseApi } from '@/api'
import { apiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import type { Exercise } from '@/types'

interface Draft {
  name: string
  description: string
  muscle_group: string
}
const EMPTY: Draft = { name: '', description: '', muscle_group: '' }

export default function Exercises({ system = false }: { system?: boolean }) {
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.role)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)

  const { data: list, isLoading } = useQuery({ queryKey: ['exercises'], queryFn: exerciseApi.list })

  // Admin screen → system exercises (trainer_id null). Trainer screen → all visible.
  const visible = (list ?? []).filter((e) => (system ? e.trainer_id == null : true))

  const save = useMutation({
    mutationFn: () =>
      editing
        ? exerciseApi.patch(editing.exercise_id, {
            name: draft.name,
            description: draft.description || null,
            muscle_group: draft.muscle_group || null,
          })
        : exerciseApi.create({
            name: draft.name,
            description: draft.description || null,
            muscle_group: draft.muscle_group || null,
          }),
    onSuccess: () => {
      toast.success(editing ? 'Упражнение обновлено' : 'Упражнение создано')
      qc.invalidateQueries({ queryKey: ['exercises'] })
      setOpen(false)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => exerciseApi.remove(id),
    onSuccess: () => {
      toast.success('Упражнение удалено')
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const openAdd = () => {
    setEditing(null)
    setDraft(EMPTY)
    setOpen(true)
  }
  const openEdit = (ex: Exercise) => {
    setEditing(ex)
    setDraft({ name: ex.name, description: ex.description ?? '', muscle_group: ex.muscle_group ?? '' })
    setOpen(true)
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={system ? 'Системные упражнения' : 'Упражнения'}
        subtitle={system ? 'Доступны всем тренерам' : 'Системные и ваши собственные'}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Упражнение
          </Button>
        }
      />

      {visible.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Упражнений нет" action={<Button onClick={openAdd}>Создать</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((ex) => (
            <Card key={ex.exercise_id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{ex.name}</p>
                  {ex.muscle_group && <Badge tone="primary" className="mt-1">{ex.muscle_group}</Badge>}
                  {ex.trainer_id == null && <Badge tone="neutral" className="ml-1 mt-1">Системное</Badge>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(ex)} className="rounded-full p-1.5 text-muted hover:bg-page" aria-label="Изменить">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove.mutate(ex.exercise_id)}
                    className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {ex.description && <p className="mt-2 text-sm text-muted">{ex.description}</p>}
              <div className="mt-3 flex items-center gap-3">
                {ex.video_url ? (
                  <a href={ex.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <Video className="h-4 w-4" /> Видео
                  </a>
                ) : (
                  <span className="text-xs text-muted">Без видео</span>
                )}
                <VideoUpload exerciseId={ex.exercise_id} disabled={role !== 'trainer' && role !== 'admin'} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Редактировать упражнение' : 'Новое упражнение'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Отменить</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!draft.name.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Название" table="exercises" attr="name">
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </Field>
          <Field label="Группа мышц" table="exercises" attr="muscle_group">
            <Input value={draft.muscle_group} onChange={(e) => setDraft((d) => ({ ...d, muscle_group: e.target.value }))} placeholder="Ноги, спина…" />
          </Field>
          <Field label="Описание" table="exercises" attr="description">
            <Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function VideoUpload({ exerciseId, disabled }: { exerciseId: number; disabled?: boolean }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: (file: File) => exerciseApi.uploadVideo(exerciseId, file),
    onSuccess: () => {
      toast.success('Видео загружено')
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })
  if (disabled) return null
  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
        disabled={upload.isPending}
      >
        <Upload className="h-4 w-4" /> {upload.isPending ? 'Загрузка…' : 'Загрузить видео'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload.mutate(f)
          e.target.value = ''
        }}
      />
    </>
  )
}
