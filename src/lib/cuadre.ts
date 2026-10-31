import type { Ingreso, Lote } from '../db/schema'
import { diasEntre } from './format'
import { pesoEstandarLb } from './standards'
import { lbEnPieDe } from './venta'

// Al pollero se le vende por libras y las aves casi nunca se cuentan: 10 por
// caja, o por el peso. La diferencia se iba juntando, y al vaciarse el galpón
// la app decía que quedaban 57 pollos que ya se habían ido. Al cerrar el ciclo
// ya se sabe cuántos salieron en ventas —los que entraron al galpón menos los
// que se murieron o se descartaron—, y con eso se cuadra: las ventas contadas
// se quedan como están, y a las estimadas les toca su parte de lo que falta
// según sus libras.

/** Los pollos que salieron del galpón en ventas en todo el ciclo. */
export function avesQueSalieron(lote: Pick<Lote, 'cantidadInicial' | 'muertosLlegada'>, bajas: number): number {
  return Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0) - bajas)
}

/** Las ventas que se cuadran: aves estimadas y con libras para repartir. */
export const seCuadra = (i: Ingreso) => !!i.avesEstimadas && lbEnPieDe(i) > 0

// Cuántos pollos lleva cada libra, venta por venta: las libras en pie entre lo
// que pesa un pollo ese día por la curva. Qué tan grande sale el pollo de este
// lote no importa, porque se reparte: solo cuenta cuánto más pesa el del
// último día que el del primero. En un mismo día es repartir por libras.
function parte(lote: Pick<Lote, 'fechaInicio'>, i: Ingreso): number {
  const dia = Math.max(1, diasEntre(lote.fechaInicio, i.fecha))
  return lbEnPieDe(i) / pesoEstandarLb(dia)
}

export interface Cuadre {
  /** Las aves de cada venta, en el mismo orden; cambian solo las estimadas. */
  cantidades: number[]
  /** Cuántas ventas se cuadraron. */
  estimadas: number
  /** Lo que pesó en pie cada pollo vendido, en promedio, de las ventas con libras. */
  pesoAveLb?: number
}

/**
 * Las aves de cada venta para que sumen las que salieron. Sin ventas
 * estimadas, o si lo que les toca no da ni un pollo a cada una, no se puede.
 */
export function cuadrarAves(
  lote: Pick<Lote, 'fechaInicio'>,
  ventas: Ingreso[],
  salieron: number,
): Cuadre | undefined {
  const estimada = ventas.map(seCuadra)
  const n = estimada.filter(Boolean).length
  const fijas = ventas.reduce((a, i, k) => (estimada[k] ? a : a + i.cantidad), 0)
  const resto = salieron - fijas
  if (n === 0 || resto < n) return undefined

  const partes = ventas.map((i, k) => (estimada[k] ? parte(lote, i) : 0))
  const totalPartes = partes.reduce((a, x) => a + x, 0)
  const exactas = partes.map((p) => (resto * p) / totalPartes)
  // A cada una lo suyo hacia abajo, y los pollos que sobran a las que más se
  // acercaban al siguiente: así suman justo.
  const cantidades = ventas.map((i, k) => (estimada[k] ? Math.floor(exactas[k]) : i.cantidad))
  const sobran = resto - cantidades.reduce((a, x, k) => (estimada[k] ? a + x : a), 0)
  const porFraccion = ventas
    .map((_, k) => k)
    .filter((k) => estimada[k])
    .sort((a, b) => exactas[b] - Math.floor(exactas[b]) - (exactas[a] - Math.floor(exactas[a])) || partes[b] - partes[a])
  for (const k of porFraccion.slice(0, sobran)) cantidades[k]++
  // Ninguna venta con libras se queda sin aves: el pollo sale de la que más tiene.
  for (const k of porFraccion)
    if (cantidades[k] === 0) {
      const mayor = porFraccion.reduce((m, j) => (cantidades[j] > cantidades[m] ? j : m), porFraccion[0])
      cantidades[mayor]--
      cantidades[k] = 1
    }

  const conLibras = ventas.map((i, k) => ({ lb: lbEnPieDe(i), aves: cantidades[k] })).filter((v) => v.lb > 0 && v.aves > 0)
  const aves = conLibras.reduce((a, v) => a + v.aves, 0)
  return {
    cantidades,
    estimadas: n,
    pesoAveLb: aves > 0 ? conLibras.reduce((a, v) => a + v.lb, 0) / aves : undefined,
  }
}

/** Lo que debería pesar en pie un pollo vendido ese día, por la curva del lote. */
export function pesoEsperadoLb(lote: Pick<Lote, 'fechaInicio'>, fecha: string, factorCurva = 1): number {
  return pesoEstandarLb(Math.max(1, diasEntre(lote.fechaInicio, fecha))) * factorCurva
}

// Si el cuadre da pollos que no pueden ser: repartir 188 pollos de más entre
// 2,000 lb da 4.1 lb cada uno a los 40 días, cuando andan por 6.7. Entonces no
// se fueron en las ventas: falta anotar una venta, o unas bajas. Con un pesaje
// la curva del lote es la suya y se le cree más; sin pesaje, la curva Cobb
// puede errar por un cuarto.
export function cuadreRaro(
  pesoAveLb: number | undefined,
  esperadoLb: number | undefined,
  conPesaje: boolean,
): 'livianos' | 'pesados' | undefined {
  if (!pesoAveLb || !esperadoLb) return undefined
  const margen = conPesaje ? 0.15 : 0.25
  const r = pesoAveLb / esperadoLb
  return r < 1 - margen ? 'livianos' : r > 1 + margen ? 'pesados' : undefined
}
