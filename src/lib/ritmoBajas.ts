import type { Ingreso, Lote, Registro } from '../db/schema'
import { diasEntre } from './format'

// Cuántas aves se van a morir de aquí a la venta. Antes era el 0.09 % por día
// de cualquier granja: con el calor del final se morían 3 por día y la app
// contaba 6 en toda la semana, y las libras y la ganancia salían de más.
// Ahora se junta lo que se le está muriendo a este lote estos días, lo que se
// les murió a las polladas cerradas de la granja con el pollo grande, y el
// estándar, cada uno según cuántas aves-día lo respaldan.

/** Lo que se muere por día de cada ave viva en cualquier granja: 0.09 %. */
export const RITMO_ESTANDAR = 0.0009
// Cuánto se le cree al estándar: como una semana de 430 aves.
const EXPOSICION_ESTANDAR = 3000
// Lo de las polladas cerradas cuenta a medias: es otra pollada, en otro tiempo.
const PESO_GRANJA = 0.5
/** Las bajas de la primera semana vienen de la incubadora y del arranque: no dicen lo que sigue. */
export const DESDE_DIA = 8
/** De las polladas cerradas cuenta lo del pollo grande, que es lo que falta al vender. */
export const DIA_POLLO_GRANDE = 22
const DIAS_RECIENTES = 7

/** Las muertes y descartes de unos días, y las aves-día que estuvieron en riesgo. */
export interface Bajas {
  muertes: number
  exposicion: number
}

/**
 * Las bajas de los días con registro entre `desde` y `hasta`, y las aves vivas
 * de cada uno de esos días. Un día sin registro no dice cuántas se murieron:
 * no cuenta.
 */
export function bajasEntre(
  lote: Pick<Lote, 'fechaInicio' | 'cantidadInicial' | 'muertosLlegada'>,
  registros: Registro[],
  ingresos: Ingreso[],
  desde: number,
  hasta = Infinity,
): Bajas {
  const colocados = Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0))
  const ventas = ingresos.filter((i) => i.tipo === 'aves')
  const ordenados = registros.filter((r) => !r.soloPeso).sort((a, b) => a.fecha.localeCompare(b.fecha))
  let antes = 0
  let muertes = 0
  let exposicion = 0
  for (const r of ordenados) {
    const dia = diasEntre(lote.fechaInicio, r.fecha)
    const hoy = (r.mortalidad ?? 0) + (r.descarte ?? 0)
    if (dia >= desde && dia <= hasta) {
      const vendidas = ventas.filter((i) => i.fecha <= r.fecha).reduce((a, i) => a + i.cantidad, 0)
      const vivas = colocados - antes - vendidas
      if (vivas > 0) {
        muertes += hoy
        exposicion += vivas
      }
    }
    antes += hoy
  }
  return { muertes, exposicion }
}

/**
 * Lo que se muere por día de cada ave viva, de aquí a la venta: lo de este
 * lote en sus últimos 7 días, lo de la granja con el pollo grande y el estándar.
 */
export function ritmoDeBajas(
  lote: Pick<Lote, 'fechaInicio' | 'cantidadInicial' | 'muertosLlegada'>,
  registros: Registro[],
  ingresos: Ingreso[],
  dia: number,
  granja?: Bajas,
): number {
  const recientes = bajasEntre(lote, registros, ingresos, Math.max(DESDE_DIA, dia - DIAS_RECIENTES + 1), dia)
  const muertes =
    RITMO_ESTANDAR * EXPOSICION_ESTANDAR + PESO_GRANJA * (granja?.muertes ?? 0) + recientes.muertes
  const exposicion = EXPOSICION_ESTANDAR + PESO_GRANJA * (granja?.exposicion ?? 0) + recientes.exposicion
  return muertes / exposicion
}

/** Cuántas de `aves` se mueren en `dias` días, a `porDia`. */
export function bajasQueFaltan(aves: number, porDia: number, dias: number): number {
  if (!(aves > 0) || !(dias > 0)) return 0
  return Math.round(aves * (1 - Math.exp(-porDia * dias)))
}
