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

const igual = (a: string, b: string) => normalizar(a) === normalizar(b)

const casan = (a: string, b: string) => {
  const x = normalizar(a)
  const y = normalizar(b)
  return x.includes(y) || y.includes(x)
}

// El plan sanitario es la agenda; las aplicaciones son lo que de verdad se puso.
// Se casan por nombre porque «marcar aplicada» crea la aplicación con el nombre
// del plan, y lo que no case queda como extra en vez de perderse. Primero los
// nombres idénticos y después los parecidos, y entre varias la de fecha más
// cercana al día del plan: así «Refuerzo Newcastle» del día 21 ya no tacha la
// «Newcastle» del día 7, que solo se le parece.
export function agendaSanitaria(
  lote: Lote,
  diaActual: number,
  plan: HitoSanitario[],
  aplicaciones: Aplicacion[],
): EventoSanitario[] {
  const diaDe = (a: Aplicacion) => diasEntre(lote.fechaInicio, a.fecha)
  const asignada = new Map<number, Aplicacion>()
  const usadas = new Set<number>()

  for (const criterio of [igual, casan]) {
    const pares: { i: number; a: Aplicacion; distancia: number }[] = []
    plan.forEach((h, i) => {
      if (asignada.has(i)) return
      for (const a of aplicaciones)
        if (!usadas.has(a.id) && criterio(a.nombre, h.nombre))
          pares.push({ i, a, distancia: Math.abs(diaDe(a) - h.dia) })
    })
    pares.sort((x, y) => x.distancia - y.distancia)
    for (const { i, a } of pares) {
      if (asignada.has(i) || usadas.has(a.id)) continue
      asignada.set(i, a)
      usadas.add(a.id)
    }
  }

  const agendados: EventoSanitario[] = plan.map((h, i) => {
    const ap = asignada.get(i)
    return {
      nombre: h.nombre,
      diaPlan: h.dia,
      fechaPlan: sumarDias(lote.fechaInicio, h.dia),
      aplicacion: ap,
      dia: ap ? diaDe(ap) : undefined,
      estado: ap ? 'aplicado' : h.dia < diaActual ? 'atrasado' : 'pendiente',
    }
  })

  const extras: EventoSanitario[] = aplicaciones
    .filter((a) => !usadas.has(a.id))
    .map((a) => ({
      nombre: a.nombre,
      aplicacion: a,
      dia: diaDe(a),
      estado: 'extra',
    }))

  return [...agendados, ...extras].sort(
    (x, y) => (x.dia ?? x.diaPlan ?? 0) - (y.dia ?? y.diaPlan ?? 0),
  )
}
