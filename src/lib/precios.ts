import type { Gasto, Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import type { Proyeccion } from './proyeccion'
import { LB_POR_QUINTAL } from './standards'

export const comprasAlimento = (gastos: Gasto[]) =>
  gastos.filter((g) => g.categoria === 'alimento')

// Precio real del quintal: promedio ponderado de lo que se pagó por los
// quintales anotados. Es undefined mientras no haya ninguna compra con cantidad.
export function precioQuintalReal(gastos: Gasto[]): number | undefined {
  const conQq = comprasAlimento(gastos).filter((g) => (g.cantidadQq ?? 0) > 0)
  if (!conQq.length) return undefined
  const qq = conQq.reduce((a, g) => a + g.cantidadQq!, 0)
  return qq > 0 ? conQq.reduce((a, g) => a + g.monto, 0) / qq : undefined
}

// Precio de la libra de alimento. Manda lo que de verdad se pagó por quintal;
// después el precio que el productor puso a mano; y de último una estimación
// entre lo gastado y lo consumido, que temprano en el ciclo se dispara porque el
// alimento se compra por adelantado.
export function precioAlimentoLb(lote: Lote, gastos: Gasto[], m: LoteMetrics): number {
  const real = precioQuintalReal(gastos)
  if (real) return real / LB_POR_QUINTAL
  if (lote.precioQuintal && lote.precioQuintal > 0) return lote.precioQuintal / LB_POR_QUINTAL
  const gastoAlimento = comprasAlimento(gastos).reduce((a, g) => a + g.monto, 0)
  return m.alimentoTotalLb > 0 && gastoAlimento > 0 ? gastoAlimento / m.alimentoTotalLb : 0
}

export interface EscalonPrecio {
  etiqueta: string
  margenPct: number
  precioLb: number
  precioPorAve: number
  ganancia: number
  gananciaPorAve: number
  esActual?: boolean
}

export interface AnalisisPrecio {
  lbEnPie: number
  aves: number
  costoTotal: number
  costoNeto: number
  costoAlimento: number
  costoAves: number
  costoOtros: number
  precioEquilibrioLb: number
  precioEquilibrioAve: number
  alimentoPctDelCosto: number
  gananciaPorPesoDeMas: number
  escalones: EscalonPrecio[]
  actual?: EscalonPrecio & { sobreEquilibrioPct: number }
}

const MARGENES = [0, 0.1, 0.15, 0.2, 0.25]

// Precio mínimo por libra para no perder, y qué se gana al venderla más cara.
// Todo se calcula sobre el cierre proyectado del ciclo (incluye el alimento que
// falta por comprar), que es la pregunta real: ¿a cómo tengo que vender?
export function analizarPrecio(
  lote: Lote,
  gastos: Gasto[],
  m: LoteMetrics,
  p: Proyeccion | null,
): AnalisisPrecio | null {
  const lbEnPie = p?.lbEnPie ?? (m.pesoEstimadoLb != null ? Math.round(m.avesVivas * m.pesoEstimadoLb) : 0)
  if (lbEnPie <= 0) return null

  const aves = p?.avesAlVender ?? m.avesVivas
  const costoTotal = p?.costoProyectado ?? m.costos
  const costoNeto = Math.max(0, costoTotal - m.ingresos)

  const gastoAlimento = gastos
    .filter((g) => g.categoria === 'alimento')
    .reduce((a, g) => a + g.monto, 0)
  const costoAlimento = gastoAlimento + (p?.costoRestante ?? 0)
  const costoAves = lote.costoInicial + gastos.filter((g) => g.categoria === 'aves').reduce((a, g) => a + g.monto, 0)
  const costoOtros = Math.max(0, costoTotal - costoAlimento - costoAves)

  const precioEquilibrioLb = costoNeto / lbEnPie
  const lbPorAve = lbEnPie / Math.max(1, aves)

  const escalon = (margen: number, etiqueta: string): EscalonPrecio => {
    const precioLb = precioEquilibrioLb / (1 - margen)
    const ganancia = precioLb * lbEnPie - costoNeto
    return {
      etiqueta,
      margenPct: margen * 100,
      precioLb,
      precioPorAve: precioLb * lbPorAve,
      ganancia,
      gananciaPorAve: ganancia / Math.max(1, aves),
    }
  }

  const escalones = MARGENES.map((margen) =>
    escalon(margen, margen === 0 ? 'No pierdo ni gano' : `Margen ${Math.round(margen * 100)}%`),
  )

  const precio = lote.precioVentaLb
  const actual = precio
    ? (() => {
        const ganancia = precio * lbEnPie - costoNeto
        const ingreso = precio * lbEnPie
        return {
          etiqueta: 'Tu precio',
          margenPct: ingreso > 0 ? (ganancia / ingreso) * 100 : 0,
          precioLb: precio,
          precioPorAve: precio * lbPorAve,
          ganancia,
          gananciaPorAve: ganancia / Math.max(1, aves),
          esActual: true,
          sobreEquilibrioPct:
            precioEquilibrioLb > 0 ? ((precio - precioEquilibrioLb) / precioEquilibrioLb) * 100 : 0,
        }
      })()
    : undefined

  return {
    lbEnPie,
    aves,
    costoTotal,
    costoNeto,
    costoAlimento,
    costoAves,
    costoOtros,
    precioEquilibrioLb,
    precioEquilibrioAve: precioEquilibrioLb * lbPorAve,
    alimentoPctDelCosto: costoTotal > 0 ? (costoAlimento / costoTotal) * 100 : 0,
    gananciaPorPesoDeMas: lbEnPie,
    escalones,
    actual,
  }
}
