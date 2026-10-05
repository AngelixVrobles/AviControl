import type { Gasto, Lote } from '../db/schema'
import { eficienciaAlimento, type LoteMetrics } from './metrics'
import { hoyISO, sumarDias } from './format'
import { comprasAlimento, precioQuintalReal } from './precios'
import {
  FASES_ALIMENTO,
  LB_POR_QUINTAL,
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
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
  // Lo que se habrá comido en los días sin dato de alimento, según la curva. No
  // entra en el FCA, pero sí en lo que queda: decir que los sacos siguen ahí
  // porque nadie los anotó es como se queda uno sin alimento un domingo.
  sinAnotarQq: number
  diasSinAnotar: number
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

  const factorEf = eficienciaAlimento(m)
  const aves = m.avesVivas > 0 ? m.avesVivas : m.cantidadInicial

  // Hoy no cuenta como día sin dato: el alimento de hoy se anota al final.
  let sinAnotarLb = 0
  let diasSinAnotar = 0
  for (let d = (m.diaAlimento ?? -1) + 1; d < m.dias; d++) {
    sinAnotarLb += alimentoDiaEstandarLb(d) * aves * factorEf
    diasSinAnotar++
  }
  const sinAnotarQq = sinAnotarLb / LB_POR_QUINTAL
  const existenciaQq = compradoQq - consumidoQq - sinAnotarQq
  const existenciaLb = existenciaQq * LB_POR_QUINTAL

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
    sinAnotarQq,
    diasSinAnotar,
    existenciaQq,
    diasQueAlcanza,
    fechaSeAcaba: sumarDias(hoyISO(), diasQueAlcanza),
    precioQuintal,
    faltaComprarQq,
    costoFaltante: precioQuintal ? faltaComprarQq * precioQuintal : undefined,
  }
}

export interface ConsumoFase {
  nombre: string
  desde: number
  hasta: number
  planALaFechaLb: number
  planTotalLb: number
  realLb: number
  porConteoLb: number
  diasRegistrados: number
  enCurso: boolean
}

// Lo que de verdad se dio en cada fase, contra lo que tocaba. El plan completo
// no sirve para juzgar una fase a medias, así que se compara contra lo que
// correspondía hasta el último día con dato de alimento: comparar lo anotado
// hasta el día 14 contra lo que tocaba hasta el 20 inventa un faltante.
export function consumoPorFase(lote: Lote, m: LoteMetrics): ConsumoFase[] {
  const aves = lote.cantidadInicial
  const diaFinal = m.diaObjetivo
  const corte = Math.min(m.dias, m.diaAlimento ?? m.dias)

  return FASES_ALIMENTO.map((f) => {
    const hasta = Math.min(f.hasta, diaFinal)
    const hastaCorte = Math.min(hasta, corte)
    const delaFase = m.alimento.dias.filter((d) => d.dia >= f.desde && d.dia <= hasta)
    const base = alimentoAcumEstandarLb(f.desde - 1)
    const realLb = delaFase.reduce((a, d) => a + d.lb, 0)
    return {
      nombre: f.nombre,
      desde: f.desde,
      hasta,
      planALaFechaLb: Math.max(0, (alimentoAcumEstandarLb(hastaCorte) - base) * aves),
      planTotalLb: Math.max(0, (alimentoAcumEstandarLb(hasta) - base) * aves),
      realLb,
      porConteoLb: realLb - delaFase.reduce((a, d) => a + d.anotadoLb, 0),
      diasRegistrados: delaFase.filter((d) => d.anotadoLb > 0).length,
      enCurso: m.dias >= f.desde && m.dias <= hasta,
    }
  }).filter((f) => f.hasta >= f.desde && f.planTotalLb > 0)
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
