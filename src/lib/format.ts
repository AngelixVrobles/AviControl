import { getSettings } from './settings'

export function money(value: number, opts: { compact?: boolean } = {}): string {
  const { moneda } = getSettings()
  const abs = Math.abs(value)
  let body: string
  if (opts.compact && abs >= 1000) {
    body = new Intl.NumberFormat('es-DO', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs)
  } else {
    body = new Intl.NumberFormat('es-DO', {
      maximumFractionDigits: 0,
    }).format(abs)
  }
  return `${value < 0 ? '−' : ''}${moneda}${body}`
}

export function num(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function pct(value: number, decimals = 1): string {
  return `${num(value, decimals)}%`
}

export function fecha(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short' }).format(d)
}

export function fechaLarga(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

export function hoyISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function diasDesde(iso: string): number {
  return diasEntre(iso, hoyISO())
}

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00').getTime()
  const b = new Date(hasta + 'T00:00:00').getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
