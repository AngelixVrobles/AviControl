import type { Aplicacion, Lote } from '../db/schema'
import { diasEntre, sumarDias } from './format'
import type { HitoSanitario } from './standards'

export interface EventoSanitario {
  nombre: string
  diaPlan?: number
  fechaPlan?: string
  aplicacion?: Aplicacion
  dia?: number
  estado: 'aplicado' | 'pendiente' | 'atrasado' | 'extra'
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

const casan = (a: string, b: string) => {
  const x = normalizar(a)
  const y = normalizar(b)
  return x.includes(y) || y.includes(x)
}

// El plan sanitario es la agenda; las aplicaciones son lo que de verdad se puso.
// Se casan por nombre porque «marcar aplicada» crea la aplicación con el nombre
// del plan, y lo que no case queda como extra en vez de perderse.
export function agendaSanitaria(
  lote: Lote,
  diaActual: number,
  plan: HitoSanitario[],
  aplicaciones: Aplicacion[],
): EventoSanitario[] {
  const usadas = new Set<number>()

  const agendados: EventoSanitario[] = plan.map((h) => {
    const ap = aplicaciones.find((a) => !usadas.has(a.id) && casan(a.nombre, h.nombre))
    if (ap) usadas.add(ap.id)
    return {
      nombre: h.nombre,
      diaPlan: h.dia,
      fechaPlan: sumarDias(lote.fechaInicio, h.dia),
      aplicacion: ap,
      dia: ap ? diasEntre(lote.fechaInicio, ap.fecha) : undefined,
      estado: ap ? 'aplicado' : h.dia < diaActual ? 'atrasado' : 'pendiente',
    }
  })

  const extras: EventoSanitario[] = aplicaciones
    .filter((a) => !usadas.has(a.id))
    .map((a) => ({
      nombre: a.nombre,
      aplicacion: a,
      dia: diasEntre(lote.fechaInicio, a.fecha),
      estado: 'extra',
    }))

  return [...agendados, ...extras].sort(
    (x, y) => (x.dia ?? x.diaPlan ?? 0) - (y.dia ?? y.diaPlan ?? 0),
  )
}
