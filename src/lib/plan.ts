import type { Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import {
  FASES_ENGORDE,
  LB_POR_QUINTAL,
  RAZA_DEFAULT,
  alimentoAcumEstandarLb,
  diaParaPeso,
} from './standards'

export interface FaseAlimento {
  nombre: string
  desde: number
  hasta: number
  lb: number
  quintales: number
  activa: boolean
}

export interface PlanAlimento {
  fases: FaseAlimento[]
  totalQuintales: number
  totalLb: number
  consumidoLb: number
  consumidoQuintales: number
  esperadoHoyLb: number
  faseActual?: FaseAlimento
  proximoCambio?: { nombre: string; enDias: number }
}

export function computePlanAlimento(lote: Lote, m: LoteMetrics): PlanAlimento | null {
  if (lote.tipo !== 'engorde') return null

  const raza = lote.raza ?? RAZA_DEFAULT
  const aves = lote.cantidadInicial
  const diaFinal = lote.pesoObjetivoLb ? diaParaPeso(lote.pesoObjetivoLb, raza) : 42

  const fases: FaseAlimento[] = FASES_ENGORDE.map((f) => {
    const hasta = Math.min(f.hasta, diaFinal)
    const lb =
      (alimentoAcumEstandarLb(hasta, raza) - alimentoAcumEstandarLb(f.desde, raza)) * aves
    return {
      nombre: f.nombre,
      desde: f.desde,
      hasta,
      lb: Math.max(0, lb),
      quintales: Math.max(0, lb) / LB_POR_QUINTAL,
      activa: m.dias >= f.desde && m.dias <= hasta,
    }
  }).filter((f) => f.hasta > f.desde)

  const totalLb = fases.reduce((a, f) => a + f.lb, 0)
  const esperadoHoyLb = alimentoAcumEstandarLb(m.dias, raza) * aves
  const faseActual = fases.find((f) => f.activa)
  const siguiente = fases.find((f) => f.desde > m.dias)

  return {
    fases,
    totalQuintales: totalLb / LB_POR_QUINTAL,
    totalLb,
    consumidoLb: m.alimentoTotalLb,
    consumidoQuintales: m.alimentoTotalLb / LB_POR_QUINTAL,
    esperadoHoyLb,
    faseActual,
    proximoCambio: siguiente ? { nombre: siguiente.nombre, enDias: siguiente.desde - m.dias } : undefined,
  }
}
