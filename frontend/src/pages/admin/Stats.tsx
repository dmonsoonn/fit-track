import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { statsApi } from '@/api'
import { PageLoader } from '@/components/ui'
import type { AdminMetrics } from '@/types'

const CHART_COLORS = ['#1E40AF', '#10B981', '#F59E0B', '#DC2626', '#8B5CF6']

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  trainer: 'Тренер',
  client: 'Клиент',
}

function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function Trend({ pct }: { pct: number | null }) {
//   if (pct === null) return <span className="text-xs text-muted">— нет данных</span>
//   if (pct === 0)
//     return (
//       <span className="flex items-center gap-0.5 text-xs text-muted">
//         <Minus className="h-3 w-3" />0%
//       </span>
//     )
//   const up = pct > 0
//   return (
//     <span
//       className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}
//     >
//       {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
//       {up ? '+' : ''}
//       {pct}%
//     </span>
//   )
}

interface MetricCardProps {
  value: number
  label: string
  sub?: string
  pct: number | null
}

function MetricCard({ value, label, sub, pct }: MetricCardProps) {
  return (
    <div className="rounded-card border border-line bg-card p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold text-ink">{value.toLocaleString('ru-RU')}</p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        </div>
        <div className="mt-1">
          <Trend pct={pct} />
        </div>
      </div>
    </div>
  )
}

function metrics2cards(m: AdminMetrics) {
  return [
    {
      value: m.total_users,
      label: 'Всего пользователей',
      sub: `Тренеров: ${m.trainers} · Клиентов: ${m.clients}`,
      pct: changePct(
        m.new_registrations_7d,
        m.new_registrations_prev7d,
      ),
    },
    {
      value: m.active_workouts_today,
      label: 'Активных тренировок сегодня',
      sub: `Неделю назад: ${m.active_workouts_today_prev}`,
      pct: changePct(m.active_workouts_today, m.active_workouts_today_prev),
    },
    {
      value: m.completed_last_30d,
      label: 'Тренировок за 30 дней',
      sub: `Предыдущий период: ${m.completed_prev_30d}`,
      pct: changePct(m.completed_last_30d, m.completed_prev_30d),
    },
    {
      value: m.new_registrations_7d,
      label: 'Новых регистраций за 7 дней',
      sub: `Предыдущий период: ${m.new_registrations_prev7d}`,
      pct: changePct(m.new_registrations_7d, m.new_registrations_prev7d),
    },
  ]
}

export default function AdminStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: statsApi.adminStats,
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoader />
  if (isError || !data)
    return (
      <p className="p-6 text-danger">Не удалось загрузить статистику. Попробуйте позже.</p>
    )

  const cards = metrics2cards(data.metrics)

  return (
    <div className="mx-auto max-w-content space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-ink">Статистика</h1>

      {/* ── Top: 4 metric cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <MetricCard key={c.label} {...c} />
        ))}
      </div>

      {/* ── Middle: charts ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Line chart */}
        <div className="rounded-card border border-line bg-card p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-ink">
            Активность за последние 30 дней
          </h2>
          {data.activity_chart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Нет данных за этот период</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.activity_chart} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v, 'Тренировок']}
                  labelFormatter={(l: string) => `Дата: ${l}`}
                  contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#1E40AF"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="rounded-card border border-line bg-card p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-ink">Распределение по целям</h2>
          {data.goal_distribution.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.goal_distribution}
                  dataKey="count"
                  nameKey="goal"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ percent }: { percent: number }) =>
                    `${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.goal_distribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span style={{ fontSize: 12, color: '#0F172A' }}>{value}</span>
                  )}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [v, name]}
                  contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom: two tables ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 5 trainers */}
        <div className="rounded-card border border-line bg-card shadow-card">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-semibold text-ink">Топ-5 активных тренеров</h2>
          </div>
          {data.top_trainers.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-page text-left text-xs text-muted">
                    <th className="px-6 py-3 font-medium">Тренер</th>
                    <th className="px-4 py-3 font-medium text-right">Клиентов</th>
                    <th className="px-4 py-3 font-medium text-right">Сессий/мес</th>
                    <th className="px-4 py-3 font-medium text-right">Выполнение</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_trainers.map((t, i) => (
                    <tr key={i} className="border-b border-line last:border-0 hover:bg-page/50">
                      <td className="px-6 py-3 font-medium text-ink">{t.name}</td>
                      <td className="px-4 py-3 text-right text-muted">{t.client_count}</td>
                      <td className="px-4 py-3 text-right text-muted">{t.monthly_sessions}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            t.completion_rate >= 75
                              ? 'font-medium text-success'
                              : t.completion_rate >= 50
                                ? 'font-medium text-warning'
                                : 'font-medium text-danger'
                          }
                        >
                          {t.completion_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent registrations */}
        <div className="rounded-card border border-line bg-card shadow-card">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-semibold text-ink">Последние регистрации</h2>
          </div>
          {data.recent_registrations.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-page text-left text-xs text-muted">
                    <th className="px-6 py-3 font-medium">Имя</th>
                    <th className="px-4 py-3 font-medium">Роль</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_registrations.map((u) => (
                    <tr
                      key={u.user_id}
                      className="border-b border-line last:border-0 hover:bg-page/50"
                    >
                      <td className="px-6 py-3 font-medium text-ink">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.is_active
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          }`}
                        >
                          {u.is_active ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
