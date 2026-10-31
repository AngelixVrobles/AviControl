import type { Pesada } from '../db/schema'

// La venta al pollero, como se anota en el cuaderno: sus cajas se pesan vacías
// por grupos —se ponen 6 en la báscula: 94 lb—, después llenas de pollo, las
// veces que haga falta, y lo que se cobra son las libras llenas menos las de
// las cajas. 503 + 534 llenas, menos 94 + 94 vacías: 849 lb de pollo.

/** Los pollos que casi siempre van en cada caja del pollero. */
export const POLLOS_POR_CAJA = 10

// Lo que se va escribiendo en la hoja: texto, porque una casilla a medio
// escribir («94.») todavía no es un número.
export interface PesadaEnEdicion {
  vacias: { cajas: string; lb: string }[]
  llenas: string[]
  pollosPorCaja: string
}

export const pesadaNueva = (): PesadaEnEdicion => ({
  vacias: [{ cajas: '', lb: '' }],
  llenas: [''],
  pollosPorCaja: '',
})

const numero = (t: string): number | undefined => {
  if (t.trim() === '') return undefined
  const v = Number(t)
  return Number.isFinite(v) ? v : undefined
}

const suma = (xs: number[]) => xs.reduce((a, x) => a + x, 0)

// Las libras con dos decimales: sumar 94.4 + 94.2 da 188.60000000000002.
const lb2 = (x: number) => Math.round(x * 100) / 100

/** Lo escrito, en números: sin las filas que faltan por llenar. */
export function leerPesada(e: PesadaEnEdicion): Pesada {
  const vacias = e.vacias.flatMap((g) => {
    const lb = numero(g.lb)
    const cajas = numero(g.cajas)
    return lb == null ? [] : [{ lb, ...(cajas != null && cajas > 0 ? { cajas: Math.round(cajas) } : {}) }]
  })
  const llenas = e.llenas.flatMap((t) => {
    const v = numero(t)
    return v == null ? [] : [v]
  })
  const pollos = numero(e.pollosPorCaja)
  return { vacias, llenas, ...(pollos != null && pollos > 0 ? { pollosPorCaja: Math.round(pollos) } : {}) }
}

/** Una pesada guardada, para corregirla en la hoja. */
export function aEdicion(p: Pesada): PesadaEnEdicion {
  return {
    vacias: p.vacias.length
      ? p.vacias.map((g) => ({ cajas: g.cajas != null ? String(g.cajas) : '', lb: String(g.lb) }))
      : [{ cajas: '', lb: '' }],
    llenas: p.llenas.length ? p.llenas.map(String) : [''],
    pollosPorCaja: p.pollosPorCaja ? String(p.pollosPorCaja) : '',
  }
}

export interface ResumenPesada {
  /** Las cajas que se contaron al pesarlas vacías. */
  cajas: number
  /** Lo que pesaron las cajas vacías. */
  tara: number
  /** Lo que pesaron llenas, todas las pesadas juntas. */
  bruto: number
  /** Las libras de pollo: llenas menos vacías. */
  neto: number
  /** Lo que pesa cada caja vacía, de los grupos en que se contaron. */
  lbPorCaja?: number
  /** Las aves, si se dijo cuántos pollos van por caja. */
  aves?: number
}

export function resumenPesada(p: Pesada): ResumenPesada {
  const tara = lb2(suma(p.vacias.map((g) => g.lb)))
  const bruto = lb2(suma(p.llenas))
  const contadas = p.vacias.filter((g) => g.cajas != null && g.cajas > 0)
  const cajas = suma(contadas.map((g) => g.cajas!))
  return {
    cajas,
    tara,
    bruto,
    neto: lb2(bruto - tara),
    lbPorCaja: cajas > 0 ? lb2(suma(contadas.map((g) => g.lb)) / cajas) : undefined,
    aves: cajas > 0 && p.pollosPorCaja ? cajas * p.pollosPorCaja : undefined,
  }
}

/** Las libras de pollo que da la pesada, cuando ya se pesaron cajas llenas. */
export function librasDePesada(p: Pesada): number {
  if (!p.llenas.length) return 0
  return Math.max(0, resumenPesada(p).neto)
}

/** Lo que impide guardar la pesada. */
export function errorPesada(e: PesadaEnEdicion): string | undefined {
  const escritos = [...e.vacias.flatMap((g) => [g.cajas, g.lb]), ...e.llenas, e.pollosPorCaja].filter(
    (t) => t.trim() !== '',
  )
  if (escritos.some((t) => !(Number(t) >= 0))) return 'Hay un número negativo o mal escrito.'
  const p = leerPesada(e)
  if (p.llenas.length && resumenPesada(p).neto <= 0)
    return 'Las cajas con pollo pesan menos que las vacías: revisa los números.'
  return undefined
}

// Cuántos pollos se fueron, por lo que pesaron. Casi todas las cajas llevan 10,
// pero hay polleros que las sobrecargan y no siempre se cuenta: las libras de
// pollo entre lo que pesa hoy cada uno lo dicen igual. Sin un pesaje no se
// estima: la curva sola puede errar por mucho.
export function avesPorPeso(netoLb: number, pesoAveLb: number | undefined): number | undefined {
  if (!(netoLb > 0) || pesoAveLb == null || !(pesoAveLb > 0)) return undefined
  return Math.round(netoLb / pesoAveLb)
}

// Si las dos cuentas no cuadran: con 12 cajas de 10 son 120, y si por el peso
// salen 133, parece que las sobrecargaron. Un 8 % de diferencia es casi un
// pollo por caja; menos que eso cabe en lo que yerra el peso estimado.
export function cuadranLasAves(porCajas: number | undefined, porPeso: number | undefined): 'mas' | 'menos' | undefined {
  if (!porCajas || !porPeso) return undefined
  const r = porPeso / porCajas
  return r >= 1.08 ? 'mas' : r <= 0.92 ? 'menos' : undefined
}
