import type { Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { diasEntre, hoyISO, sumarDias } from './format'
import { pesoEstandarLb } from './standards'

export interface Proyeccion {
  listo: boolean
  fechaEstimada: string
  diasRestantes: number
  alimentoRestanteLb: number
  lbEnPie: number
}

// Proyecta escalando la curva estándar al rendimiento real del lote
// (peso actual / peso estándar del mismo día).
export function proyectarVenta(
  lote: Lote,
  registros: Registro[],
  m: LoteMetrics,
  objetivoLb: number,
): Proyeccion | null {
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!conPeso.length || m.avesVivas <= 0) return null

  const ultimo = conPeso[conPeso.length - 1]
  const pesoActual = ultimo.pesoPromedio!
  if (pesoActual >= objetivoLb) {
    return {
      listo: true,
      fechaEstimada: hoyISO(),
      diasRestantes: 0,
      alimentoRestanteLb: 0,
      lbEnPie: Math.round(m.avesVivas * pesoActual),
    }
  }

  const diaUltimo = diasEntre(lote.fechaInicio, ultimo.fecha)
  const ratio = pesoActual / Math.max(0.05, pesoEstandarLb(diaUltimo))
  let dia = diaUltimo + 1
  while (dia <= 90 && pesoEstandarLb(dia) * ratio < objetivoLb) dia++
  if (dia > 90) return null

  const fechaEstimada = sumarDias(lote.fechaInicio, dia)
  const fca = m.fca && m.fca > 0.5 ? m.fca : 1.8
  return {
    listo: false,
    fechaEstimada,
    diasRestantes: diasEntre(hoyISO(), fechaEstimada),
    alimentoRestanteLb: Math.round(fca * m.avesVivas * (objetivoLb - pesoActual)),
    lbEnPie: Math.round(m.avesVivas * objetivoLb),
  }
}
