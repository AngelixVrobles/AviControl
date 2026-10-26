import { getSettings } from './settings'
import { LB_POR_QUINTAL } from './standards'

// Los formateadores se arman una vez y se guardan: uno nuevo por cada número y
// cada fecha hacía que mil fechas tardaran 858 ms en un Android lento, contra 5
// ms así. Reportes con muchos ciclos se trababa casi un segundo.
const numeros = new Map<string, Intl.NumberFormat>()
function formatoNumero(min: number, max: number, compacto = false): Intl.NumberFormat {
  const clave = `${min}|${max}|${compacto}`
  let f = numeros.get(clave)
  if (!f) {
    f = new Intl.NumberFormat(
      'es-DO',
      compacto
        ? { notation: 'compact', maximumFractionDigits: max }
        : { minimumFractionDigits: min, maximumFractionDigits: max },
    )
    numeros.set(clave, f)
  }
  return f
}

const fechas = new Map<string, Intl.DateTimeFormat>()
function formatoFecha(opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const clave = JSON.stringify(opciones)
  let f = fechas.get(clave)
  if (!f) {
    f = new Intl.DateTimeFormat('es-DO', opciones)
    fechas.set(clave, f)
  }
  return f
}

// La moneda también se guarda: leer y descifrar los ajustes en cada monto era
// la otra mitad de la lentitud. Cambia cuando cambian los ajustes.
let moneda: string | undefined
if (typeof window !== 'undefined') window.addEventListener('settings-changed', () => (moneda = undefined))
const monedaActual = () => (moneda ??= getSettings().moneda)

export function money(value: number, opts: { compact?: boolean; decimales?: number } = {}): string {
  const abs = Math.abs(value)
  const body =
    opts.compact && abs >= 1000
      ? formatoNumero(0, 1, true).format(abs)
      : formatoNumero(opts.decimales ?? 0, opts.decimales ?? 0).format(abs)
  // Un valor negativo que redondea a cero no lleva signo: «−RD$0» no existe.
  const negativo = value < 0 && Number(body.replace(/[^0-9]/g, '')) > 0
  return `${negativo ? '−' : ''}${monedaActual()}${body}`
}

// Los precios por libra se comparan entre sí y deciden la venta: redondear
// RD$46.52 a RD$47 son más de mil pesos en un galpón de 2.500 lb, y hace que
// dos escalones distintos de la tabla se vean con el mismo precio.
export const porLb = (value: number) => money(value, { decimales: 2 })

// es-DO alterna «8 K» y «16 k» según la magnitud; en un mismo eje se ve mal.
export function numCompacto(value: number): string {
  return formatoNumero(0, 1, true)
    .format(value)
    .replace('K', 'k')
    .replace('-', '−')
}

export const plural = (n: number, singular: string, plural: string) =>
  Math.abs(n) === 1 ? singular : plural

// «hoy», «ayer», «hace 12 días»: «hace 0 días» no lo dice nadie.
export const haceCuanto = (dias: number) =>
  dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${num(dias)} días`

// «desde hoy», «desde ayer», «desde hace 12 días».
export const desdeHace = (dias: number) => `desde ${haceCuanto(dias)}`

// «3 ciclos, 12 gastos y 2 ventas»: lo que hay, sin lo que está en cero.
export function enumerar(partes: readonly (readonly [number, string, string])[]): string {
  const lista = partes
    .filter(([n]) => n > 0)
    .map(([n, uno, varios]) => `${num(n)} ${plural(n, uno, varios)}`)
  return lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}` : (lista[0] ?? '')
}

export function num(value: number, decimals = 0): string {
  // El guion de restar es más corto que el menos y desalinea una columna de
  // cifras tabulares; `money` ya usaba el menos de verdad.
  return formatoNumero(decimals, decimals)
    .format(value)
    .replace('-', '−')
}

// Hasta `max` decimales y sin ceros de relleno: 2 sacos, 2.5 sacos, 1.75 sacos.
export function numCorto(value: number, max = 2): string {
  return formatoNumero(0, max)
    .format(value)
    .replace('-', '−')
}

// El alimento se piensa en sacos de 100 lb (un quintal) o en libras, según
// cómo lo lleve cada quien; por dentro siempre se guarda en libras.
export function alimentoEn(lb: number, unidad: 'qq' | 'lb'): string {
  if (unidad === 'lb') return `${num(lb)} lb`
  const sacos = lb / LB_POR_QUINTAL
  return `${numCorto(sacos)} ${Math.abs(sacos) === 1 ? 'saco' : 'sacos'}`
}

export function pct(value: number, decimals = 1): string {
  return `${num(value, decimals)}%`
}

export function fecha(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return formatoFecha({ day: '2-digit', month: 'short' }).format(d)
}

export function fechaLarga(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return formatoFecha({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

// Con el año: «12 de octubre de 2026». Para lo que puede ser de otro año, como
// la fecha de un respaldo.
export function fechaCompleta(iso: string): string {
  return formatoFecha({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T00:00:00'))
}

/** «octubre», o con `anio` «oct. 2026». */
export function mes(iso: string, { anio = false }: { anio?: boolean } = {}): string {
  return formatoFecha(anio ? { month: 'short', year: 'numeric' } : { month: 'long' }).format(
    new Date(iso + 'T00:00:00'),
  )
}

export function hoyISO(): string {
  return diaLocal(new Date())
}

// El día de un momento, en la hora de aquí. Cortar el texto de toISOString()
// da el día de Londres: a las 9 de la noche ya es mañana.
export function diaLocal(momento: Date | string): string {
  const d = typeof momento === 'string' ? new Date(momento) : momento
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
