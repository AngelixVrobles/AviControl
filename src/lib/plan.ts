import type { Gasto, Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { hoyISO, sumarDias } from './format'
import { comprasAlimento, precioQuintalReal } from './precios'
import {
  FASES_ALIMENTO,
  LB_POR_QUINTAL,
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
  fcaEstandar,
} from './standards'

export interface FasePlan {
  nombre: string
  desde: number
  hasta: number
  proteinaPct: string
  kcalKg: number
  presentacion: string
  lb: number
  quintales: number
  costo?: number
  activa: boolean
  cumplida: boolean
}

export interface PlanAlimento {
  fases: FasePlan[]
  totalLb: number
  totalQuintales: number
  costoTotal?: number
  consumidoLb: number
  consumidoQuintales: number
  restanteQuintales: number
  esperadoHoyLb: number
  faseActual?: FasePlan
  proximoCambio?: { nombre: string; enDias: number }
}

export interface InventarioAlimento {
  completo: boolean
  comprasSinCantidad: number
  compradoQq: number
  consumidoQq: number
  existenciaQq: number
  diasQueAlcanza: number
  fechaSeAcaba: string
  precioQuintal?: number
  faltaComprarQq: number
  costoFaltante?: number
}

// Existencia de alimento en el galpón. Solo cuadra si TODAS las compras tienen
// sus quintales anotados; con una sola compra sin cantidad el saldo miente, y es
// mejor no mostrarlo que mostrarlo mal.
export function computeInventarioAlimento(
  gastos: Gasto[],
  m: LoteMetrics,
  totalPlanQq: number,
): InventarioAlimento | null {
  const compras = comprasAlimento(gastos)
  if (!compras.length) return null

  const comprasSinCantidad = compras.filter((g) => !(g.cantidadQq && g.cantidadQq > 0)).length
  const compradoQq = compras.reduce((a, g) => a + (g.cantidadQq ?? 0), 0)
  const consumidoQq = m.alimentoTotalLb / LB_POR_QUINTAL
  const existenciaQq = compradoQq - consumidoQq
  const existenciaLb = existenciaQq * LB_POR_QUINTAL

  const factorEf = m.fca && m.fca > 0.5 ? m.fca / fcaEstandar(m.dias) : 1
  const aves = m.avesVivas > 0 ? m.avesVivas : m.cantidadInicial
  let acumulado = 0
  let diasQueAlcanza = 0
  for (let d = m.dias + 1; d <= 70 && existenciaLb > 0; d++) {
    acumulado += alimentoDiaEstandarLb(d) * aves * factorEf
    if (acumulado > existenciaLb) break
    diasQueAlcanza++
  }

  const precioQuintal = precioQuintalReal(gastos)
  const faltaComprarQq = Math.max(0, totalPlanQq - compradoQq)

  return {
    completo: comprasSinCantidad === 0,
    comprasSinCantidad,
    compradoQq,
    consumidoQq,
    existenciaQq,
    diasQueAlcanza,
    fechaSeAcaba: sumarDias(hoyISO(), diasQueAlcanza),
    precioQuintal,
    faltaComprarQq,
    costoFaltante: precioQuintal ? faltaComprarQq * precioQuintal : undefined,
  }
}

// El plan se dimensiona con las aves recibidas, no con las vivas: el alimento se
// compra por adelantado y quedarse corto a mitad de fase sale más caro.
export function computePlanAlimento(
  lote: Lote,
  m: LoteMetrics,
  precioQuintal?: number,
): PlanAlimento | null {
  if (lote.tipo !== 'engorde') return null

  const aves = lote.cantidadInicial
  const diaFinal = m.diaObjetivo

  const fases: FasePlan[] = FASES_ALIMENTO.map((f) => {
    const hasta = Math.min(f.hasta, diaFinal)
    const lb = Math.max(0, (alimentoAcumEstandarLb(hasta) - alimentoAcumEstandarLb(f.desde - 1)) * aves)
    const quintales = lb / LB_POR_QUINTAL
    return {
      ...f,
      hasta,
      lb,
      quintales,
      costo: precioQuintal ? quintales * precioQuintal : undefined,
      activa: m.dias >= f.desde && m.dias <= hasta,
      cumplida: m.dias > hasta,
    }
  }).filter((f) => f.hasta >= f.desde && f.lb > 0)

  const totalLb = fases.reduce((a, f) => a + f.lb, 0)
  const totalQuintales = totalLb / LB_POR_QUINTAL
  const siguiente = fases.find((f) => f.desde > m.dias)

  return {
    fases,
    totalLb,
    totalQuintales,
    costoTotal: precioQuintal ? totalQuintales * precioQuintal : undefined,
    consumidoLb: m.alimentoTotalLb,
    consumidoQuintales: m.alimentoTotalLb / LB_POR_QUINTAL,
    restanteQuintales: Math.max(0, totalQuintales - m.alimentoTotalLb / LB_POR_QUINTAL),
    esperadoHoyLb: alimentoAcumEstandarLb(m.dias) * aves,
    faseActual: fases.find((f) => f.activa),
    proximoCambio: siguiente
      ? { nombre: siguiente.nombre, enDias: siguiente.desde - m.dias }
      : undefined,
  }
}
