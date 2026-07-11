import type { Gasto, Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { diasEntre, hoyISO, sumarDias } from './format'
import { LB_POR_QUINTAL, RAZA_DEFAULT, pesoEstandarLb } from './standards'

export interface Proyeccion {
  listo: boolean
  fechaEstimada: string
  diasRestantes: number
  alimentoRestanteLb: number
  alimentoRestanteQuintales: number
  lbEnPie: number
  costoProyectado: number
  ingresoProyectado?: number
  gananciaProyectada?: number
  margenProyectadoPct?: number
  precioEquilibrioLb: number
}

// Proyecta escalando la curva estándar al rendimiento real del lote
// (peso actual / peso estándar del mismo día).
export function proyectarVenta(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
  objetivoLb: number,
): Proyeccion | null {
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!conPeso.length || m.avesVivas <= 0) return null

  const raza = lote.raza ?? RAZA_DEFAULT
  const ultimo = conPeso[conPeso.length - 1]
  const pesoActual = ultimo.pesoPromedio!
  const listo = pesoActual >= objetivoLb

  let fechaEstimada = hoyISO()
  let alimentoRestanteLb = 0
  if (!listo) {
    const diaUltimo = diasEntre(lote.fechaInicio, ultimo.fecha)
    const ratio = pesoActual / Math.max(0.05, pesoEstandarLb(diaUltimo, raza))
    let dia = diaUltimo + 1
    while (dia <= 90 && pesoEstandarLb(dia, raza) * ratio < objetivoLb) dia++
    if (dia > 90) return null
    fechaEstimada = sumarDias(lote.fechaInicio, dia)
    const fca = m.fca && m.fca > 0.5 ? m.fca : 1.8
    alimentoRestanteLb = Math.round(fca * m.avesVivas * (objetivoLb - pesoActual))
  }

  const pesoVenta = listo ? pesoActual : objetivoLb
  const lbEnPie = Math.round(m.avesVivas * pesoVenta)

  const feedGasto = gastos.filter((g) => g.categoria === 'alimento').reduce((a, g) => a + g.monto, 0)
  const precioAlimentoLb = m.alimentoTotalLb > 0 && feedGasto > 0 ? feedGasto / m.alimentoTotalLb : 0
  const costoRestante = precioAlimentoLb
    ? alimentoRestanteLb * precioAlimentoLb
    : m.dias > 0
      ? (m.costos / m.dias) * diasEntre(hoyISO(), fechaEstimada)
      : 0
  const costoProyectado = m.costos + costoRestante

  const precio = lote.precioVentaLb
  const ingresoProyectado = precio ? m.ingresos + lbEnPie * precio : undefined
  const gananciaProyectada = ingresoProyectado != null ? ingresoProyectado - costoProyectado : undefined
  const margenProyectadoPct =
    ingresoProyectado && ingresoProyectado > 0 ? (gananciaProyectada! / ingresoProyectado) * 100 : undefined

  return {
    listo,
    fechaEstimada,
    diasRestantes: diasEntre(hoyISO(), fechaEstimada),
    alimentoRestanteLb,
    alimentoRestanteQuintales: alimentoRestanteLb / LB_POR_QUINTAL,
    lbEnPie,
    costoProyectado,
    ingresoProyectado,
    gananciaProyectada,
    margenProyectadoPct,
    precioEquilibrioLb: lbEnPie > 0 ? costoProyectado / lbEnPie : 0,
  }
}
