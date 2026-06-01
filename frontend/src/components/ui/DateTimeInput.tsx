import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { parseDate } from '@/lib/format'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** ISO datetime string or null/undefined */
  value: string | null | undefined
  onChange: (iso: string | null) => void
}

// "dd/mm/yyyy HH:mm" → "yyyy-mm-ddTHH:mm:00±HH:MM" | null
// Includes local timezone offset so the server stores the correct UTC time.
function ruToIso(ru: string): string | null {
  const m = ru.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min] = m
  const h = Number(hh), mi = Number(min)
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), h, mi)
  if (isNaN(date.getTime()) || date.getDate() !== Number(dd)) return null
  if (h > 23 || mi > 59) return null
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const absOff = Math.abs(off)
  const offH = String(Math.floor(absOff / 60)).padStart(2, '0')
  const offM = String(absOff % 60).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00${sign}${offH}:${offM}`
}

// ISO datetime | null → "dd/mm/yyyy HH:mm"
function isoToRu(iso: string | null | undefined): string {
  const d = parseDate(iso)
  if (!d) return ''
  // Use local time
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  const s = local.toISOString()
  // s = "yyyy-mm-ddTHH:mm:ss.000Z" in UTC equivalent of local time
  const [datePart, timePart] = s.split('T')
  const [yyyy, mm, dd] = datePart.split('-')
  const [hh, min] = timePart.split(':')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

// Apply dd/mm/yyyy HH:mm mask to raw user input (12 significant digits)
function applyMask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 12)
  let r = d.slice(0, Math.min(2, d.length))
  if (d.length > 2) r += '/' + d.slice(2, Math.min(4, d.length))
  if (d.length > 4) r += '/' + d.slice(4, Math.min(8, d.length))
  if (d.length > 8) r += ' ' + d.slice(8, Math.min(10, d.length))
  if (d.length > 10) r += ':' + d.slice(10, 12)
  return r
}

const fieldBase =
  'w-full rounded-input border border-line bg-white px-3 h-11 text-ink placeholder:text-muted/40 ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-page disabled:text-muted'

export function DateTimeInput({ value, onChange, className, disabled, ...rest }: Props) {
  const [display, setDisplay] = useState(() => isoToRu(value))

  useEffect(() => {
    setDisplay(isoToRu(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    setDisplay(masked)
    if (masked.length === 16) {
      onChange(ruToIso(masked))
    } else if (masked.length === 0) {
      onChange(null)
    }
  }

  function handleBlur() {
    if (display.length === 0) {
      onChange(null)
      return
    }
    const iso = ruToIso(display)
    if (iso) {
      onChange(iso)
      setDisplay(isoToRu(iso))
    } else {
      setDisplay('')
      onChange(null)
    }
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="дд/мм/гггг ЧЧ:мм"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(fieldBase, className)}
    />
  )
}
