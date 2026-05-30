import type { FitnessLevel, WorkoutStatus } from '@/types'

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** "24" + "мая" + "сб" pieces for schedule date chips. */
export function dateParts(value: string): { day: string; month: string; weekday: string } {
  const d = parseDate(value)
  if (!d) return { day: '—', month: '', weekday: '' }
  return {
    day: String(d.getDate()),
    month: MONTHS_SHORT[d.getMonth()],
    weekday: WEEKDAYS[d.getDay()],
  }
}

export function formatTime(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return ''
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** "24 мая 2025, сб" */
export function formatLongDate(value: string | Date): string {
  const d = typeof value === 'string' ? parseDate(value) : value
  if (!d) return ''
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]}`
}

/** "15.03.1995" */
export function formatShortDate(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

/** "26.05.2025 · 19:30" */
export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return ''
  return `${formatShortDate(value)} · ${formatTime(value)}`
}

/** YYYY-MM-DD for API path params (uses local date, not UTC). */
export function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Convert <input type="datetime-local"> value to a string the Go FlexTime parses.
 * datetime-local yields "YYYY-MM-DDTHH:MM" (no seconds); the backend layouts
 * require seconds ("YYYY-MM-DDTHH:MM:SS"), so append ":00" when missing. */
export function fromDateTimeLocal(value: string | null | undefined): string | null {
  if (!value) return null
  return value.length === 16 ? `${value}:00` : value
}

export function toDateTimeLocal(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return ''
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? '').trim()[0] ?? ''
  const b = (last ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export const LEVEL_LABEL: Record<FitnessLevel, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
}

export const STATUS_LABEL: Record<WorkoutStatus, string> = {
  planned: 'Запланирована',
  completed: 'Завершена',
  skipped: 'Пропущена',
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim()
}
