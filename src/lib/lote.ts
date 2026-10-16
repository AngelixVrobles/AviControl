import type { Lote } from '../db/schema'
import { fecha, num } from './format'
import type { LoteMetrics } from './metrics'
import { getSettings } from './settings'

// El peso de venta de un ciclo: el suyo si se lo pusiste, si no el de Ajustes.
// Antes los ciclos sin peso propio usaban 5.5 lb fijo y el ajuste no servía de
// nada: cambiarlo a 6 lb no movía ni el día de venta ni el precio mínimo.
export const pesoObjetivoDe = (lote: Lote): number => {
  const propio = lote.pesoObjetivoLb
  return propio != null && propio > 0 ? propio : getSettings().pesoObjetivoLb
}

// Un ciclo activo que se quedó sin aves —se vendieron todas con «Venta» o no
// sobrevivió ninguna— ya no pide registro del día ni pesaje: lo que falta es
// cerrarlo.
export const sinAves = (m: Pick<LoteMetrics, 'avesVivas' | 'cantidadInicial'>) =>
  m.cantidadInicial > 0 && m.avesVivas <= 0

export interface LimitesLote {
  /** Lo primero que se anotó del galpón: el inicio no puede quedar después. */
  primeraFecha?: string
  /** Las aves que ya salieron: bajas, descartes y vendidas. */
  salidas: number
  fechaCierre?: string
}

// Lo que no se puede corregir sin romper lo anotado: un inicio después del
// primer registro deja días negativos, y menos pollitos de los que ya salieron
// deja el galpón con aves de menos.
export function erroresLote(
  datos: { fechaInicio: string; cantidad: number },
  limites: LimitesLote,
): { fechaInicio?: string; cantidad?: string } {
  const out: { fechaInicio?: string; cantidad?: string } = {}
  if (!datos.fechaInicio) out.fechaInicio = 'Pon el día en que llegaron los pollitos.'
  else if (limites.fechaCierre && datos.fechaInicio > limites.fechaCierre)
    out.fechaInicio = `El ciclo cerró el ${fecha(limites.fechaCierre)}.`
  else if (limites.primeraFecha && datos.fechaInicio > limites.primeraFecha)
    out.fechaInicio = `Hay datos anotados desde el ${fecha(limites.primeraFecha)}.`

  if (!(datos.cantidad > 0)) out.cantidad = 'Pon cuántos pollitos recibiste.'
  else if (datos.cantidad < limites.salidas)
    out.cantidad = `Ya salieron ${num(limites.salidas)} entre bajas, descartes y ventas.`
  return out
}
