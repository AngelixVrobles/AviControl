import type { Ingreso, Lote } from '../db/schema'
import { money } from './format'
import { POLLOS_POR_CAJA, resumenPesada } from './pesada'
import type { Settings } from './settings'
import { RINDE_ARREGLADO_PCT } from './standards'

// Cómo se vende el pollo, para las cuentas que miran hacia adelante: la
// ganancia estimada, el precio mínimo, el mejor día para vender. En pie se
// cobra la libra viva; arreglado, la libra limpia: menos libras a mejor precio,
// y arreglar cada pollo cuesta el gas, las fundas, el hielo.
export interface ModoVenta {
  arreglado: boolean
  /** Lo que queda arreglado de cada libra en pie: 0.75. En pie, 1. */
  rinde: number
  /** Lo que cuesta arreglar cada pollo. En pie, nada. */
  costoAve: number
}

export const EN_PIE: ModoVenta = { arreglado: false, rinde: 1, costoAve: 0 }

/** Un rinde que se puede creer: ni la mitad del pollo, ni casi el pollo entero. */
export const rindeValido = (pct: unknown): pct is number =>
  typeof pct === 'number' && pct >= 50 && pct <= 95

export function modoVenta(s: Pick<Settings, 'venta' | 'rindePct' | 'costoArregloAve'>): ModoVenta {
  if (s.venta !== 'arreglado') return EN_PIE
  return {
    arreglado: true,
    rinde: (rindeValido(s.rindePct) ? s.rindePct : RINDE_ARREGLADO_PCT) / 100,
    costoAve: s.costoArregloAve > 0 ? s.costoArregloAve : 0,
  }
}

// Las libras en pie que salieron del galpón con una venta. Las arregladas
// pesan menos que el pollo vivo: 300 lb arregladas a 75 % fueron 400 en pie, y
// contarlas como 300 empeoraba la conversión y el peso por ave.
export function lbEnPieDe(i: Pick<Ingreso, 'pesoLb' | 'arreglado'>): number {
  const lb = i.pesoLb ?? 0
  if (!(lb > 0)) return 0
  if (!i.arreglado) return lb
  const pct = rindeValido(i.arreglado.rindePct) ? i.arreglado.rindePct : RINDE_ARREGLADO_PCT
  return lb / (pct / 100)
}

// El precio por libra de una venta: el que se puso, y si no se guardó, el
// total entre las libras. El total se redondea a pesos, así que el que se puso
// es el exacto: 12.3 lb a 65 son 800, y 800 entre 12.3 da 65.04.
export function precioDe(i: Pick<Ingreso, 'precioLb' | 'monto' | 'pesoLb'>): number | undefined {
  if (i.precioLb != null && i.precioLb > 0) return i.precioLb
  return i.pesoLb && i.pesoLb > 0 && i.monto > 0 ? Math.round((i.monto / i.pesoLb) * 100) / 100 : undefined
}

// A cómo ha salido la libra en las ventas pesadas que se vendieron igual,
// arregladas o en pie: el precio de cada comprador pesa por sus libras.
export function precioPromedio(ingresos: Ingreso[], arreglado: boolean): number | undefined {
  const ventas = ingresos.filter(
    (i) => i.tipo === 'aves' && (i.pesoLb ?? 0) > 0 && i.monto > 0 && !!i.arreglado === arreglado,
  )
  const lb = ventas.reduce((a, i) => a + i.pesoLb!, 0)
  return lb > 0 ? ventas.reduce((a, i) => a + i.monto, 0) / lb : undefined
}

export interface PreciosDeVenta {
  /** Los precios de las últimas ventas, el más reciente primero, sin repetir. */
  recientes: { arreglado: number[]; pie: number[] }
  /** El último precio de cada comprador, por su nombre en minúsculas. */
  porComprador: Map<string, { precio: number; arreglado: boolean }>
  /** Sus cajas la última vez que se pesaron: cuánto pesa cada una y cuántos pollos llevaba. */
  cajasDe: Map<string, { lbPorCaja?: number; pollosPorCaja?: number }>
  /** La última venta se pesó por cajas: la próxima sale igual. */
  porCajas: boolean
  /** Los pollos por caja de costumbre en la granja: 10, o lo que ponga la mayoría de los polleros. */
  pollosPorCaja: number
}

// Cada quien paga su precio: a uno se le vende a 65, a otro a 55, al compadre
// a 44. Para no escribirlo cada vez, los precios que se han usado y el último
// de cada comprador.
export function preciosDeVenta(ingresos: Ingreso[], max = 4): PreciosDeVenta {
  const ventas = ingresos
    .filter((i) => i.tipo === 'aves')
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado)
  const recientes = { arreglado: [] as number[], pie: [] as number[] }
  const porComprador = new Map<string, { precio: number; arreglado: boolean }>()
  const cajasDe = new Map<string, { lbPorCaja?: number; pollosPorCaja?: number }>()
  // Cuántos polleros van con cada cuenta de pollos por caja, cada uno con la
  // suya de la última vez; una venta sin nombre cuenta sola.
  const cuentas = new Map<number, number>()
  for (const i of ventas) {
    const nombre = i.comprador?.trim().toLowerCase()
    if (i.pesada && !(nombre && cajasDe.has(nombre))) {
      const ppc = i.pesada.pollosPorCaja
      if (nombre) cajasDe.set(nombre, { lbPorCaja: resumenPesada(i.pesada).lbPorCaja, pollosPorCaja: ppc })
      if (ppc) cuentas.set(ppc, (cuentas.get(ppc) ?? 0) + 1)
    }
    const precio = precioDe(i)
    if (precio == null) continue
    const lista = i.arreglado ? recientes.arreglado : recientes.pie
    if (lista.length < max && !lista.includes(precio)) lista.push(precio)
    if (nombre && !porComprador.has(nombre)) porComprador.set(nombre, { precio, arreglado: !!i.arreglado })
  }
  // Lo de la granja: 10 por caja, salvo que más polleros vayan con otra cuenta,
  // y al menos dos: el que sobrecarga, solo, no la mueve; si casi todos ponen
  // 12, va en 12. Si empatan, la menor: el que sobrecarga pone más, no menos.
  let pollosPorCaja = POLLOS_POR_CAJA
  let polleros = cuentas.get(POLLOS_POR_CAJA) ?? 0
  for (const [ppc, n] of cuentas)
    if (n >= 2 && (n > polleros || (n === polleros && ppc < pollosPorCaja))) {
      pollosPorCaja = ppc
      polleros = n
    }
  return { recientes, porComprador, cajasDe, porCajas: !!ventas[0]?.pesada, pollosPorCaja }
}

// Lo que vale hoy lo que está en el galpón. Con el precio del ciclo, vendido
// como se vende —arreglado, menos lo que cuesta arreglarlo—; sin él, en pie al
// precio del mercado, que es el de la libra viva.
export function valorHoy(
  aves: number,
  pesoLb: number | undefined,
  precioCiclo: number | undefined,
  precioMercado: number | undefined,
  modo: ModoVenta,
): number {
  if (pesoLb == null || !(aves > 0)) return 0
  if (precioCiclo) return Math.max(0, aves * (pesoLb * modo.rinde * precioCiclo - modo.costoAve))
  return precioMercado ? aves * pesoLb * precioMercado : 0
}

export interface ArregladoContraPie {
  /** Lo que darían en pie, al precio del pollero. */
  enPie: number
  /** Lo que dan arreglados a tu precio, menos lo que cuesta arreglarlos. */
  arreglado: number
  /** El precio de la libra arreglada al que da lo mismo arreglarlo o venderlo en pie. */
  precioIgualLb: number
}

// ¿Conviene arreglarlo? A 32 la libra en pie y 75 % de rinde, la libra
// arreglada tiene que pasar de 42.67 —más lo de arreglarlo— para que valga la
// pena el trabajo: venderlo a 44 deja casi lo mismo que en pie.
export function arregladoContraPie(
  aves: number,
  pesoLb: number,
  precioArregladoLb: number,
  precioPieLb: number,
  modo: ModoVenta,
): ArregladoContraPie {
  return {
    enPie: aves * pesoLb * precioPieLb,
    arreglado: aves * (pesoLb * modo.rinde * precioArregladoLb - modo.costoAve),
    precioIgualLb: (precioPieLb * pesoLb + modo.costoAve) / (pesoLb * modo.rinde),
  }
}

/** El precio sin centavos si no los tiene: «RD$60», «RD$62.50». */
export const precioCorto = (p: number) => money(p, { decimales: Number.isInteger(p) ? 0 : 2 })

// El precio con que arranca una venta nueva, según cómo sale el pollo: el del
// ciclo, si se vende como se acostumbra; si no, el de la última venta que salió
// así; y en pie, de último, el del mercado. El de la última venta puede ser el
// del compadre, por eso va después del que se puso al ciclo.
export function precioSugerido(
  arreglado: boolean,
  { precios, lote, settings }: { precios?: PreciosDeVenta; lote: Pick<Lote, 'precioVentaLb'>; settings: Settings },
): number | undefined {
  const delCiclo = (settings.venta === 'arreglado') === arreglado ? lote.precioVentaLb : undefined
  if (delCiclo) return delCiclo
  const ultimo = precios?.recientes[arreglado ? 'arreglado' : 'pie'][0]
  return ultimo ?? (arreglado ? undefined : settings.precioMercadoLb)
}
