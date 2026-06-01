import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Dumbbell, Pencil, Plus, Trash2, Upload, Video } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageLoader, Textarea, toast } from '@/components/ui'
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
  // File selected in create-mode, uploaded together with the exercise on save
  const [pendingVideo, setPendingVideo] = useState<File | null>(null)
  // Tracks whether a video was uploaded during the current edit-modal session
  const [uploadedThisSession, setUploadedThisSession] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: list, isLoading } = useQuery({ queryKey: ['exercises'], queryFn: exerciseApi.list })
  const visible = (list ?? []).filter((e) => (system ? e.trainer_id == null : true))

  function closeModal() {
    setOpen(false)
    setEditing(null)
    setDraft(EMPTY)
    setPendingVideo(null)
    setUploadedThisSession(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(),
        description: draft.description || null,
        muscle_group: draft.muscle_group || null,
      }
      if (editing) {
        return exerciseApi.patch(editing.exercise_id, body)
      }
      const ex = await exerciseApi.create(body)
      if (pendingVideo) {
        await exerciseApi.uploadVideo(ex.exercise_id, pendingVideo)
      }
      return ex
    },
    onSuccess: () => {
      toast.success(editing ? 'Упражнение обновлено' : 'Упражнение создано')
      qc.invalidateQueries({ queryKey: ['exercises'] })
      closeModal()
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
    setPendingVideo(null)
    setUploadedThisSession(false)
    setOpen(true)
  }
  const openEdit = (ex: Exercise) => {
    setEditing(ex)
    setDraft({ name: ex.name, description: ex.description ?? '', muscle_group: ex.muscle_group ?? '' })
    setPendingVideo(null)
    setUploadedThisSession(false)
    setOpen(true)
  }

  // True when the exercise in the modal currently has a video (existing or just uploaded)
  const modalHasVideo = !!editing?.video_url || uploadedThisSession

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
                {(role === 'admin' || ex.trainer_id !== null) && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEdit(ex)} className="rounded-full p-1.5 text-muted hover:bg-page" aria-label="Изменить">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(ex.exercise_id)}
                      className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {ex.description && <p className="mt-2 text-sm text-muted">{ex.description}</p>}
              {/* Video status — link if present, neutral label if not. No upload button on the card. */}
              <div className="mt-3">
                {ex.video_url ? (
                  <a
                    href={ex.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Video className="h-4 w-4" /> Видео
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <Video className="h-3.5 w-3.5 opacity-40" /> Без видео
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { remove.mutate(deleteId!); setDeleteId(null) }}
        title="Удалить упражнение?"
        message="Это действие нельзя отменить."
        confirmLabel="Удалить"
        destructive
      />

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? 'Редактировать упражнение' : 'Новое упражнение'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal}>Отменить</Button>
            <Button
              onClick={() => {
                if (!draft.name.trim()) { toast.error('Введите название упражнения'); return }
                save.mutate()
              }}
              loading={save.isPending}
              disabled={!draft.name.trim()}
            >
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
            <Input
              value={draft.muscle_group}
              onChange={(e) => setDraft((d) => ({ ...d, muscle_group: e.target.value }))}
              placeholder="Ноги, спина…"
            />
          </Field>
          <Field label="Описание" table="exercises" attr="description">
            <Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>

          {/* ── Video section ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            {editing ? (
              /* Edit mode: show current status + upload/replace button */
              <>
                {modalHasVideo ? (
                  <span className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> Видео загружено
                  </span>
                ) : (
                  <span className="text-sm text-muted">Видео не загружено</span>
                )}
                <VideoUpload
                  exerciseId={editing.exercise_id}
                  label={modalHasVideo ? 'Заменить видео' : 'Загрузить видео'}
                  onUploaded={() => setUploadedThisSession(true)}
                />
              </>
            ) : (
              /* Create mode: local file picker, uploaded together with the exercise */
              <>
                {pendingVideo ? (
                  <>
                    <span className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="max-w-[180px] truncate">{pendingVideo.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingVideo(null)}
                      className="text-xs text-muted hover:text-danger"
                    >
                      Убрать
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted">Видео (необязательно)</span>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-primary hover:underline">
                      <Upload className="h-4 w-4" /> Прикрепить видео
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) setPendingVideo(f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function VideoUpload({
  exerciseId,
  label,
  onUploaded,
}: {
  exerciseId: number
  label: string
  onUploaded: () => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: (file: File) => exerciseApi.uploadVideo(exerciseId, file),
    onSuccess: () => {
      toast.success('Видео загружено')
      qc.invalidateQueries({ queryKey: ['exercises'] })
      onUploaded()
    },
    onError: (e) => toast.error(apiError(e)),
  })
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {upload.isPending ? 'Загрузка…' : label}
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
