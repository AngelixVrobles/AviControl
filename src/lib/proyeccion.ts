import type { Gasto, Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { diasEntre, hoyISO, sumarDias } from './format'
import { precioAlimentoLb } from './precios'
import {
  LB_POR_QUINTAL,
  alimentoAcumEstandarLb,
  diaParaPeso,
  fcaEstandar,
  mortalidadEsperadaPct,
  pesoEstandarLb,
} from './standards'

export interface Proyeccion {
  listo: boolean
  fechaEstimada: string
  diaVenta: number
  diasRestantes: number
  alimentoRestanteLb: number
  alimentoRestanteQuintales: number
  avesAlVender: number
  pesoVentaLb: number
  lbEnPie: number
  costoRestante: number
  costoProyectado: number
  ingresoProyectado?: number
  gananciaProyectada?: number
  margenProyectadoPct?: number
  precioEquilibrioLb: number
}

// Proyecta escalando la curva Cobb al rendimiento real del lote y descontando la
// mortalidad que todavía falta por ocurrir hasta el día de venta.
export function proyectarVenta(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
  objetivoLb: number,
): Proyeccion | null {
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!conPeso.length || m.avesVivas <= 0) return null

  const ultimo = conPeso[conPeso.length - 1]
  const diaUltimo = diasEntre(lote.fechaInicio, ultimo.fecha)
  const pesoActual = ultimo.pesoPromedio!
  const listo = pesoActual >= objetivoLb

  const diaVenta = listo ? m.dias : diaParaPeso(objetivoLb, m.factorCurva)
  if (!listo && pesoEstandarLb(diaVenta) * m.factorCurva < objetivoLb) return null

  const fechaEstimada = listo ? hoyISO() : sumarDias(lote.fechaInicio, diaVenta)
  const diasRestantes = diasEntre(hoyISO(), fechaEstimada)

  const bajasEsperadas = listo
    ? 0
    : Math.round(
        (lote.cantidadInicial *
          Math.max(0, mortalidadEsperadaPct(diaVenta) - mortalidadEsperadaPct(m.dias))) /
          100,
      )
  const avesAlVender = Math.max(0, m.avesVivas - bajasEsperadas)

  // El alimento que falta sale de la curva de consumo (que se dispara al final
  // del ciclo) escalada por lo ineficiente que va el lote: los días extra cuestan
  // proporcionalmente más de lo que engordan.
  let alimentoRestanteLb = 0
  if (!listo) {
    const factorEf = m.fca && m.fca > 0.5 ? m.fca / fcaEstandar(diaUltimo) : 1
    const consumoStd = Math.max(
      0,
      alimentoAcumEstandarLb(diaVenta) - alimentoAcumEstandarLb(Math.max(diaUltimo, m.dias)),
    )
    const avesPromedio = (m.avesVivas + avesAlVender) / 2
    alimentoRestanteLb = Math.round(avesPromedio * consumoStd * factorEf)
  }

  const pesoVentaLb = listo ? pesoActual : objetivoLb
  const lbEnPie = Math.round(avesAlVender * pesoVentaLb)

  const precioLb = precioAlimentoLb(lote, gastos, m)
  const costoRestante = precioLb
    ? alimentoRestanteLb * precioLb
    : m.dias > 0
      ? (m.costos / m.dias) * diasRestantes
      : 0
  const costoProyectado = m.costos + costoRestante

  const precio = lote.precioVentaLb
  const ingresoProyectado = precio ? m.ingresos + lbEnPie * precio : undefined
  const gananciaProyectada = ingresoProyectado != null ? ingresoProyectado - costoProyectado : undefined
  const margenProyectadoPct =
    ingresoProyectado && ingresoProyectado > 0
      ? (gananciaProyectada! / ingresoProyectado) * 100
      : undefined

  return {
    listo,
    fechaEstimada,
    diaVenta,
    diasRestantes,
    alimentoRestanteLb,
    alimentoRestanteQuintales: alimentoRestanteLb / LB_POR_QUINTAL,
    avesAlVender,
    pesoVentaLb,
    lbEnPie,
    costoRestante,
    costoProyectado,
    ingresoProyectado,
    gananciaProyectada,
    margenProyectadoPct,
    precioEquilibrioLb: lbEnPie > 0 ? costoProyectado / lbEnPie : 0,
  }
}
