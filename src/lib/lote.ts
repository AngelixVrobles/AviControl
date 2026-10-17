import type { Lote } from '../db/schema'
import { fecha, hoyISO, num } from './format'
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

// El último día que se puede anotar en el ciclo: hoy, o el cierre si ya cerró.
export function topeDelCiclo(lote: Pick<Lote, 'fechaCierre'>, hoy = hoyISO()): string {
  return lote.fechaCierre && lote.fechaCierre < hoy ? lote.fechaCierre : hoy
}

// Los días del ciclo van de la llegada de los pollitos a hoy, o al cierre. Una
// fecha fuera de ahí descuadra las cuentas sin que se note: un día anotado por
// error el mes que viene callaba el aviso de días sin registro hasta esa fecha.
export function errorFechaDelCiclo(
  f: string,
  lote: Pick<Lote, 'fechaInicio' | 'fechaCierre'>,
  hoy = hoyISO(),
): string | undefined {
  if (!f) return 'Pon la fecha.'
  if (f < lote.fechaInicio) return `Es antes de que llegaran los pollitos (${fecha(lote.fechaInicio)}).`
  const tope = topeDelCiclo(lote, hoy)
  if (f > tope) return tope === hoy ? 'Esa fecha todavía no llega.' : `El ciclo cerró el ${fecha(tope)}.`
  return undefined
}

// Para lo que puede ser de antes del ciclo o de después del cierre —una compra
// adelantada, un abono, una entrega entre socios— pero no del futuro.
export function errorFechaFutura(f: string, hoy = hoyISO()): string | undefined {
  if (!f) return 'Pon la fecha.'
  return f > hoy ? 'Esa fecha todavía no llega.' : undefined
}

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
  datos: { fechaInicio: string; cantidad: number; muertosLlegada?: number },
  limites: LimitesLote,
): { fechaInicio?: string; cantidad?: string; muertosLlegada?: string } {
  const out: { fechaInicio?: string; cantidad?: string; muertosLlegada?: string } = {}
  const doa = datos.muertosLlegada ?? 0
  if (!datos.fechaInicio) out.fechaInicio = 'Pon el día en que llegaron los pollitos.'
  else if (limites.fechaCierre && datos.fechaInicio > limites.fechaCierre)
    out.fechaInicio = `El ciclo cerró el ${fecha(limites.fechaCierre)}.`
  else if (limites.primeraFecha && datos.fechaInicio > limites.primeraFecha)
    out.fechaInicio = `Hay datos anotados desde el ${fecha(limites.primeraFecha)}.`

  if (!(datos.cantidad > 0)) out.cantidad = 'Pon cuántos pollitos recibiste.'
  else if (doa >= datos.cantidad) out.muertosLlegada = 'Son más de los pollitos que recibiste.'
  else if (datos.cantidad < limites.salidas + doa)
    out.cantidad = `Ya salieron ${num(limites.salidas)} entre bajas, descartes y ventas${
      doa > 0 ? `, y ${num(doa)} llegaron muertos` : ''
    }.`
  return out
}
