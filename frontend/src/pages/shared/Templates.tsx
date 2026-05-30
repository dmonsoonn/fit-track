import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Badge, Button, Card, Chip, ChipGroup, EmptyState, Field, Modal, PageLoader, Select, Textarea, toast } from '@/components/ui'
import { templateApi, trainerApi } from '@/api'
import { apiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { fullName } from '@/lib/format'
import type { MessageTemplate, TemplateType } from '@/types'

const TYPE_LABEL: Record<TemplateType, string> = {
  confirmation: 'Подтверждение',
  reschedule: 'Перенос',
  feedback: 'Обратная связь',
}
const TYPES: TemplateType[] = ['confirmation', 'reschedule', 'feedback']

export default function Templates({ system = false }: { system?: boolean }) {
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.role)
  const [filter, setFilter] = useState<TemplateType | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [sendFor, setSendFor] = useState<MessageTemplate | null>(null)
  const [text, setText] = useState('')
  const [type, setType] = useState<TemplateType>('confirmation')

  const { data: list, isLoading } = useQuery({ queryKey: ['templates'], queryFn: templateApi.list })

  const filtered = useMemo(() => {
    let items = list ?? []
    if (system) items = items.filter((t) => t.scope === 'system')
    if (filter !== 'all') items = items.filter((t) => t.type === filter)
    return items
  }, [list, filter, system])

  const create = useMutation({
    mutationFn: () => templateApi.create({ text, type, ...(system ? { scope: 'system' } : {}) }),
    onSuccess: () => {
      toast.success('Шаблон создан')
      qc.invalidateQueries({ queryKey: ['templates'] })
      setCreateOpen(false)
      setText('')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => templateApi.remove(id),
    onSuccess: () => {
      toast.success('Шаблон удалён')
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={system ? 'Системные шаблоны' : 'Шаблоны сообщений'}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Шаблон
          </Button>
        }
      />

      <ChipGroup>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Все</Chip>
        {TYPES.map((t) => (
          <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </ChipGroup>

      <div className="mt-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Шаблонов нет" />
        ) : (
          filtered.map((t) => (
            <Card key={t.message_template_id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="primary">{TYPE_LABEL[t.type]}</Badge>
                  {t.scope === 'system' && <Badge tone="neutral">Системный</Badge>}
                </div>
                <p className="text-sm text-ink">{t.text}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {role === 'trainer' && (
                  <button onClick={() => setSendFor(t)} className="rounded-full p-1.5 text-muted hover:bg-primary-50 hover:text-primary" aria-label="Отправить">
                    <Send className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => remove.mutate(t.message_template_id)}
                  className="rounded-full p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый шаблон"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отменить</Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!text.trim()}>
              Создать
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Тип" table="message_templates" attr="type">
            <Select value={type} onChange={(e) => setType(e.target.value as TemplateType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Текст" table="message_templates" attr="text">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст сообщения для клиента" />
          </Field>
        </div>
      </Modal>

      <SendModal template={sendFor} onClose={() => setSendFor(null)} />
    </div>
  )
}

function SendModal({ template, onClose }: { template: MessageTemplate | null; onClose: () => void }) {
  const [clientUserId, setClientUserId] = useState('')
  const { data: clients } = useQuery({
    queryKey: ['trainer-clients'],
    queryFn: trainerApi.clients,
    enabled: !!template,
  })
  const send = useMutation({
    mutationFn: () => templateApi.send(template!.message_template_id, Number(clientUserId)),
    onSuccess: () => {
      toast.success('Сообщение отправлено клиенту')
      onClose()
      setClientUserId('')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Modal
      open={!!template}
      onClose={onClose}
      title="Отправить шаблон клиенту"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Отменить</Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!clientUserId}>
            Отправить
          </Button>
        </div>
      }
    >
      {template && <p className="mb-3 rounded-card bg-page p-3 text-sm text-muted">{template.text}</p>}
      <Field label="Клиент" table="clients" attr="user_id">
        <Select value={clientUserId} onChange={(e) => setClientUserId(e.target.value)}>
          <option value="">Выберите клиента…</option>
          {(clients ?? []).map((c) => (
            <option key={c.client_id} value={c.user_id}>
              {fullName(c.first_name, c.last_name)}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  )
}
