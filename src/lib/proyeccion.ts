import type { Gasto, Lote, Registro } from '../db/schema'
import { eficienciaAlimento, type LoteMetrics } from './metrics'
import { diasEntre, hoyISO, sumarDias } from './format'
import { computeInventarioAlimento } from './plan'
import { precioAlimentoLb } from './precios'
import {
  LB_POR_QUINTAL,
  alimentoAcumEstandarLb,
  diaParaPeso,
  mortalidadEsperadaPct,
  pesoEstandarLb,
} from './standards'

export interface Proyeccion {
  listo: boolean
  fechaEstimada: string
  diaVenta: number
  diasRestantes: number
  // Lo que se va a comer hasta la venta, y de eso lo que hay que comprar: el
  // alimento que ya está en el almacén se pagó y está en los costos.
  alimentoRestanteLb: number
  alimentoRestanteQuintales: number
  existenciaLb: number
  alimentoPorComprarLb: number
  alimentoPorComprarQuintales: number
  sobranteLb: number
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
    const factorEf = eficienciaAlimento(m)
    const consumoStd = Math.max(
      0,
      alimentoAcumEstandarLb(diaVenta) - alimentoAcumEstandarLb(Math.max(diaUltimo, m.dias)),
    )
    const avesPromedio = (m.avesVivas + avesAlVender) / 2
    alimentoRestanteLb = Math.round(avesPromedio * consumoStd * factorEf)
  }

  const pesoVentaLb = listo ? pesoActual : objetivoLb
  const lbEnPie = Math.round(avesAlVender * pesoVentaLb)

  // El alimento del almacén ya está pagado y dentro de `m.costos`: cobrarlo
  // otra vez como consumo futuro subía el precio de equilibrio en todo lo que
  // se compró por adelantado. Solo se descuenta si el saldo cuadra (todas las
  // compras con sus quintales); si no, se supone que todo falta por comprar,
  // que se equivoca hacia el lado seguro. Lo que sobre al vender se queda en
  // los costos de este ciclo, que es donde se pagó: así el cierre real y lo
  // proyectado cuentan igual.
  const inventario = computeInventarioAlimento(gastos, m, 0)
  const existenciaLb = inventario?.completo
    ? Math.max(0, inventario.existenciaQq) * LB_POR_QUINTAL
    : 0
  const alimentoPorComprarLb = Math.max(0, alimentoRestanteLb - existenciaLb)
  const sobranteLb = Math.max(0, existenciaLb - alimentoRestanteLb)

  const precioLb = precioAlimentoLb(lote, gastos, m)
  const costoRestante = precioLb
    ? alimentoPorComprarLb * precioLb
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
    existenciaLb,
    alimentoPorComprarLb,
    alimentoPorComprarQuintales: alimentoPorComprarLb / LB_POR_QUINTAL,
    sobranteLb,
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
