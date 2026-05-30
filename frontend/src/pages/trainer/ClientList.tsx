import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Copy, Search, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Avatar, Badge, Button, Card, Chip, ChipGroup, EmptyState, Input, Modal, PageLoader, toast } from '@/components/ui'
import { trainerApi } from '@/api'
import { fullName, initials, LEVEL_LABEL } from '@/lib/format'

type Filter = 'all' | 'with' | 'without'

export default function ClientList() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: clients, isLoading } = useQuery({ queryKey: ['trainer-clients'], queryFn: trainerApi.clients })
  const { data: trainer } = useQuery({ queryKey: ['trainer-me'], queryFn: trainerApi.me })

  const filtered = useMemo(() => {
    let list = clients ?? []
    if (filter === 'with') list = list.filter((c) => c.active_plan)
    if (filter === 'without') list = list.filter((c) => !c.active_plan)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((c) => fullName(c.first_name, c.last_name).toLowerCase().includes(term))
    return list
  }, [clients, filter, q])

  const withPlan = (clients ?? []).filter((c) => c.active_plan).length

  const copyCode = () => {
    if (!trainer) return
    navigator.clipboard.writeText(trainer.invite_code)
    toast.success('Код скопирован')
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Клиенты"
        subtitle={`Всего: ${clients?.length ?? 0} · Активных программ: ${withPlan}`}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Клиент
          </Button>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Поиск по имени..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ChipGroup>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Все</Chip>
        <Chip active={filter === 'with'} onClick={() => setFilter('with')}>С программой</Chip>
        <Chip active={filter === 'without'} onClick={() => setFilter('without')}>Без программы</Chip>
      </ChipGroup>

      <div className="mt-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Клиентов нет"
            description="Поделитесь кодом приглашения, чтобы клиенты могли зарегистрироваться."
            action={<Button onClick={() => setInviteOpen(true)}>Показать код</Button>}
          />
        ) : (
          filtered.map((c) => (
            <Card
              key={c.client_id}
              className="flex cursor-pointer items-center gap-3 p-4 transition-shadow hover:shadow-pop"
              onClick={() => navigate(`/trainer/clients/${c.client_id}`)}
            >
              <Avatar text={initials(c.first_name, c.last_name)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{fullName(c.first_name, c.last_name)}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {c.level && <Badge tone="primary">{LEVEL_LABEL[c.level]}</Badge>}
                  {c.goal && <span className="text-sm text-muted">{c.goal}</span>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {c.active_plan ? c.active_plan : 'Программа не назначена'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Card>
          ))
        )}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Код приглашения">
        <p className="mb-4 text-sm text-muted">
          Клиенты регистрируются самостоятельно, указав этот код. После регистрации они появятся
          в списке.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-input border border-line bg-page px-4 py-3 text-center font-mono text-lg tracking-widest">
            {trainer?.invite_code ?? '—'}
          </div>
          <Button variant="outline" onClick={copyCode}>
            <Copy className="h-4 w-4" /> Копировать
          </Button>
        </div>
      </Modal>
    </div>
  )
}
