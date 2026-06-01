import type { Role } from '@/types'
import {
  BarChart2,
  Bell,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LayoutList,
  Salad,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** show the unread-notification badge on this item */
  badge?: boolean
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  client: [
    { to: '/profile', label: 'Личный кабинет', icon: User },
    { to: '/schedule', label: 'Расписание', icon: CalendarDays },
    { to: '/progress', label: 'Прогресс', icon: TrendingUp },
    { to: '/food-diary', label: 'Дневник питания', icon: Salad },
    { to: '/notifications', label: 'Уведомления', icon: Bell, badge: true },
  ],
  trainer: [
    { to: '/trainer/profile', label: 'Профиль', icon: User },
    { to: '/trainer/clients', label: 'Клиенты', icon: Users },
    { to: '/trainer/exercises', label: 'Упражнения', icon: Dumbbell },
    { to: '/trainer/templates', label: 'Шаблоны', icon: ClipboardList },
    { to: '/trainer/notifications', label: 'Уведомления', icon: Bell, badge: true },
  ],
  admin: [
    { to: '/admin/stats', label: 'Статистика', icon: BarChart2 },
    { to: '/admin/users', label: 'Пользователи', icon: Users },
    { to: '/admin/exercises', label: 'Упражнения', icon: Dumbbell },
    { to: '/admin/templates', label: 'Шаблоны', icon: LayoutList },
  ],
}

export const HOME_BY_ROLE: Record<Role, string> = {
  client: '/profile',
  trainer: '/trainer/profile',
  admin: '/admin/users',
}
