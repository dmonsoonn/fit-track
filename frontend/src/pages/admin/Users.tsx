import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageWrapper'
import { Avatar, Badge, Button, Card, Chip, ChipGroup, ConfirmDialog, EmptyState, Input, Modal, PageLoader, Select, StatCard, toast } from '@/components/ui'
import { adminApi } from '@/api'
import { apiError } from '@/api/client'
import { fullName, initials, formatShortDate } from '@/lib/format'
import type { Role, User } from '@/types'

type Filter = 'all' | 'trainer' | 'client' | 'blocked'
const ROLE_LABEL: Record<Role, string> = { admin: 'Админ', trainer: 'Тренер', client: 'Клиент' }

export default function AdminUsers() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<User | null>(null)

  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })

  const stats = useMemo(() => {
    const list = users ?? []
    return {
      trainers: list.filter((u) => u.role === 'trainer').length,
      clients: list.filter((u) => u.role === 'client').length,
      active: list.filter((u) => u.is_active).length,
      blocked: list.filter((u) => !u.is_active).length,
    }
  }, [users])

  const filtered = useMemo(() => {
    let list = users ?? []
    if (filter === 'trainer') list = list.filter((u) => u.role === 'trainer')
    if (filter === 'client') list = list.filter((u) => u.role === 'client')
    if (filter === 'blocked') list = list.filter((u) => !u.is_active)
    const term = q.trim().toLowerCase()
    if (term)
      list = list.filter(
        (u) =>
          fullName(u.first_name, u.last_name).toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term),
      )
    return list
  }, [users, filter, q])

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Управление пользователями" subtitle="Тренеры и клиенты системы" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={stats.trainers} label="Тренеров" />
        <StatCard value={stats.clients} label="Клиентов" />
        <StatCard value={stats.active} label="Активных" />
        <StatCard value={stats.blocked} label="Заблокировано" />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChipGroup>
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Все</Chip>
          <Chip active={filter === 'trainer'} onClick={() => setFilter('trainer')}>Тренеры</Chip>
          <Chip active={filter === 'client'} onClick={() => setFilter('client')}>Клиенты</Chip>
          <Chip active={filter === 'blocked'} onClick={() => setFilter('blocked')}>Заблокированные</Chip>
        </ChipGroup>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Поиск по имени или email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Пользователи не найдены" />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-page/60 text-left text-muted">
                  <th className="px-4 py-3 font-semibold">Пользователь</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Роль</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Регистрация</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.user_id} className={i % 2 ? 'bg-page/40' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar text={initials(u.first_name, u.last_name)} size="sm" />
                        <span className="font-medium text-ink">{fullName(u.first_name, u.last_name)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.email}</td>
                    <td className="px-4 py-3"><Badge tone="primary">{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="px-4 py-3">
                      {u.is_active ? <Badge tone="success">Активен</Badge> : <Badge tone="danger">Заблокирован</Badge>}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatShortDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Изменить</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((u) => (
              <Card key={u.user_id} className="flex items-center gap-3 p-4">
                <Avatar text={initials(u.first_name, u.last_name)} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{fullName(u.first_name, u.last_name)}</p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone="primary">{ROLE_LABEL[u.role]}</Badge>
                    {u.is_active ? <Badge tone="success">Активен</Badge> : <Badge tone="danger">Заблокирован</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Изменить</Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} />
    </div>
  )
}

function EditUserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>('client')
  const [active, setActive] = useState(true)
  const [delOpen, setDelOpen] = useState(false)

  // sync local state when a user is selected
  useEffect(() => {
    if (user) {
      setRole(user.role)
      setActive(user.is_active)
    }
  }, [user])

  const save = useMutation({
    mutationFn: () => adminApi.patchUser(user!.user_id, { role, is_active: active }),
    onSuccess: () => {
      toast.success('Пользователь обновлён')
      onSaved()
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })
  const del = useMutation({
    mutationFn: () => adminApi.removeUser(user!.user_id),
    onSuccess: () => {
      toast.success('Пользователь удалён')
      onSaved()
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <>
    <Modal
      open={!!user}
      onClose={onClose}
      title={user ? fullName(user.first_name, user.last_name) : ''}
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="text-danger" onClick={() => setDelOpen(true)} loading={del.isPending}>
            Удалить
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Отменить</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>Сохранить</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5" data-table="users" data-attr="role">
          <label className="text-sm font-medium">Роль</label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="client">Клиент</option>
            <option value="trainer">Тренер</option>
            <option value="admin">Администратор</option>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-card border border-line p-3" data-table="users" data-attr="is_active">
          <span className="text-sm font-medium">Активен</span>
          <button
            onClick={() => setActive((a) => !a)}
            className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-success' : 'bg-line'}`}
            aria-pressed={active}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${active ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </Modal>

    <ConfirmDialog
      open={delOpen}
      onClose={() => setDelOpen(false)}
      onConfirm={() => { del.mutate(); setDelOpen(false) }}
      title="Удалить пользователя?"
      message="Аккаунт будет удалён безвозвратно."
      confirmLabel="Удалить"
      destructive
    />
    </>
  )
}
