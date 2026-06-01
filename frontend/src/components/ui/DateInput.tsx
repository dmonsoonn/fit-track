import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** ISO date string "yyyy-mm-dd" or null/undefined */
  value: string | null | undefined
  onChange: (iso: string | null) => void
}

// "dd/mm/yyyy" → "yyyy-mm-dd" | null
function ruToIso(ru: string): string | null {
  const m = ru.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (isNaN(d.getTime()) || d.getDate() !== Number(dd)) return null
  return `${yyyy}-${mm}-${dd}`
}

// "yyyy-mm-dd" | null → "dd/mm/yyyy"
function isoToRu(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

// Apply dd/mm/yyyy mask to raw user input
function applyMask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  let r = d.slice(0, 2)
  if (d.length > 2) r += '/' + d.slice(2, 4)
  if (d.length > 4) r += '/' + d.slice(4, 8)
  return r
}

const fieldBase =
  'w-full rounded-input border border-line bg-white px-3 h-11 text-ink placeholder:text-muted/40 ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-page disabled:text-muted'

export function DateInput({ value, onChange, className, disabled, ...rest }: Props) {
  const [display, setDisplay] = useState(() => isoToRu(value))

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    setDisplay(isoToRu(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    setDisplay(masked)
    // Call parent immediately when we have a complete valid date
    if (masked.length === 10) {
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
      setDisplay(isoToRu(iso)) // normalise display
    } else {
      // Invalid — clear
      setDisplay('')
      onChange(null)
    }
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="дд/мм/гггг"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(fieldBase, className)}
    />
  )
}
