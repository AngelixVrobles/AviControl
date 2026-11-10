import type { Ingreso } from '../db/schema'
import { RINDE_ARREGLADO_PCT } from './standards'
import { formaYPrecio, lbEnPieDe, rindeValido, ventasPorPrecio } from './venta'

// Al pollero se le vende casi todo, por libra y más barato; a la gente que se
// lleva uno o dos, aparte, por unidad o arreglado y más caro. La ganancia
// estimada cobraba todo lo que faltaba al precio del ciclo. Ahora se aprende de
// las polladas cerradas qué parte de las aves se vende aparte y cuánto más deja
// cada una que al precio de la venta grande, y lo que falta se cobra así.

/** Lo que se vendió aparte en una pollada cerrada, contra lo que habría dejado al precio de la venta grande. */
export interface MezclaCiclo {
  aves: number
  aparte: number
  ingresoAparte: number
  /** Lo que habrían dejado esas mismas aves al precio de la venta grande. */
  valorAparte: number
}

export interface MezclaGranja {
  /** Qué parte de las aves de una pollada se vende aparte: 0.1 es 1 de cada 10. */
  aparte: number
  /** Cuánto más deja cada una de esas que al precio de la venta grande: 0.2 es 20 %. */
  prima: number
}

// Menos de 1 de cada 100 aparte no cambia la cuenta; una prima fuera de esto
// es una venta mal anotada.
const APARTE_MINIMO = 0.01
const PRIMA_MIN = -0.5
const PRIMA_MAX = 1

export function mezclaDeCiclo(ingresos: Ingreso[]): MezclaCiclo | undefined {
  const ventas = ingresos.filter((i) => formaYPrecio(i))
  const [grande] = ventasPorPrecio(ventas)
  // Si todo se vendió por unidad, no hay libra con qué comparar.
  if (!grande || grande.forma === 'unidad') return undefined
  const pesadas = ventas.filter((i) => (i.pesoLb ?? 0) > 0 && i.cantidad > 0)
  const avesPesadas = pesadas.reduce((a, i) => a + i.cantidad, 0)
  const pesoAve = avesPesadas > 0 ? pesadas.reduce((a, i) => a + lbEnPieDe(i), 0) / avesPesadas : 0
  if (!(pesoAve > 0)) return undefined
  // Lo que rinde arreglado el pollo de la venta grande, si se vendió así.
  const deLaGrande = ventas.filter((i) => {
    const fp = formaYPrecio(i)!
    return fp.forma === grande.forma && fp.precio === grande.precio
  })
  const rindes = deLaGrande.map((i) => i.arreglado?.rindePct).filter(rindeValido)
  const rinde = (rindes.length ? rindes.reduce((a, x) => a + x, 0) / rindes.length : RINDE_ARREGLADO_PCT) / 100
  const alPrecioGrande = (i: Ingreso) => {
    const lbPie = (i.pesoLb ?? 0) > 0 ? lbEnPieDe(i) : Math.max(0, i.cantidad) * pesoAve
    return lbPie * (grande.forma === 'arreglado' ? rinde : 1) * grande.precio
  }
  let aves = 0
  let aparte = 0
  let ingresoAparte = 0
  let valorAparte = 0
  for (const i of ventas) {
    aves += Math.max(0, i.cantidad)
    if (deLaGrande.includes(i)) continue
    aparte += Math.max(0, i.cantidad)
    ingresoAparte += i.monto
    valorAparte += alPrecioGrande(i)
  }
  return aves > 0 ? { aves, aparte, ingresoAparte, valorAparte } : undefined
}

/** Lo de la granja, de sus polladas cerradas: las más recientes, con su peso. */
export function mezclaDeGranja(ciclos: { mezcla?: MezclaCiclo; peso: number }[]): MezclaGranja | undefined {
  let aves = 0
  let aparte = 0
  let ingreso = 0
  let valor = 0
  for (const { mezcla: c, peso } of ciclos) {
    if (!c) continue
    aves += peso * c.aves
    aparte += peso * c.aparte
    ingreso += peso * c.ingresoAparte
    valor += peso * c.valorAparte
  }
  if (!(aves > 0) || !(valor > 0) || aparte / aves < APARTE_MINIMO) return undefined
  return { aparte: aparte / aves, prima: Math.min(PRIMA_MAX, Math.max(PRIMA_MIN, ingreso / valor - 1)) }
}

/** Las aves vendidas en este ciclo que no fueron a su precio: por unidad, o a otro precio. */
export function vendidasAparte(ingresos: Ingreso[], precioCiclo: number | undefined): number {
  if (!precioCiclo) return 0
  return ingresos.reduce((a, i) => {
    const fp = formaYPrecio(i)
    if (!fp) return a
    const alPrecio = fp.forma !== 'unidad' && Math.abs(fp.precio - precioCiclo) < 0.5
    return alPrecio ? a : a + Math.max(0, i.cantidad)
  }, 0)
}

export interface MezclaPorVender {
  /** Las aves de las que faltan que se espera vender aparte. */
  aves: number
  prima: number
  /** Cuánto más deja lo que falta por vender que todo al precio del ciclo: 1.02 es 2 % más. */
  factor: number
}

/**
 * Lo que falta por vender, con lo que la granja suele vender aparte: menos lo
 * que ya se vendió aparte en este ciclo, que ya no falta.
 */
export function mezclaPorVender(
  granja: MezclaGranja | undefined,
  vendidas: number,
  yaAparte: number,
  porVender: number,
): MezclaPorVender | undefined {
  if (!granja || !(porVender > 0)) return undefined
  const aves = Math.min(porVender, Math.max(0, Math.round(granja.aparte * (vendidas + porVender) - yaAparte)))
  if (aves < 1) return undefined
  return { aves, prima: granja.prima, factor: 1 + (aves / porVender) * granja.prima }
}
