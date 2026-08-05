import type { Gasto, Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { diasEntre, sumarDias } from './format'
import { precioAlimentoLb } from './precios'
import {
  PESO_OBJETIVO_DEFAULT,
  alimentoAcumEstandarLb,
  fcaEstandar,
  mortalidadEsperadaPct,
  pesoEstandarLb,
} from './standards'

export interface PuntoVenta {
  dia: number
  fecha: string
  pesoLb: number
  aves: number
  lbEnPie: number
  costo: number
  ganancia: number
  costoLbMarginal: number
}

export interface AnalisisOptimo {
  puntos: PuntoVenta[]
  hoy: PuntoVenta
  optimo: PuntoVenta
  tope: PuntoVenta
  excedeObjetivo: boolean
  objetivoLb: number
  diaCruce?: number
  precioVentaLb: number
  gananciaExtra: number
}

const HORIZONTE_DIAS = 21

// A partir de cierta edad el pollo convierte tan mal que la libra que gana
// cuesta más de lo que se vende. Este cálculo recorre día por día lo que queda
// del ciclo y busca el día en que la ganancia total es máxima: el costo marginal
// de la última libra contra el precio de venta.
export function analizarPuntoOptimo(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
): AnalisisOptimo | null {
  const precioVentaLb = lote.precioVentaLb
  const precioAlim = precioAlimentoLb(lote, gastos, m)
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!precioVentaLb || !precioAlim || !conPeso.length || m.avesVivas <= 0) return null

  const diaUltimo = diasEntre(lote.fechaInicio, conPeso[conPeso.length - 1].fecha)
  const factorEf = m.fca && m.fca > 0.5 ? m.fca / fcaEstandar(diaUltimo) : 1
  const desde = Math.max(m.dias, diaUltimo)

  const puntos: PuntoVenta[] = []
  let previo: PuntoVenta | undefined
  for (let dia = desde; dia <= Math.min(56, desde + HORIZONTE_DIAS); dia++) {
    const pesoLb = pesoEstandarLb(dia) * m.factorCurva
    const bajas = Math.round(
      (lote.cantidadInicial * Math.max(0, mortalidadEsperadaPct(dia) - mortalidadEsperadaPct(desde))) /
        100,
    )
    const aves = Math.max(0, m.avesVivas - bajas)
    const avesPromedio = (m.avesVivas + aves) / 2
    const consumo = Math.max(0, alimentoAcumEstandarLb(dia) - alimentoAcumEstandarLb(desde))
    const costo = m.costos + consumo * avesPromedio * factorEf * precioAlim
    const lbEnPie = aves * pesoLb
    const ganancia = m.ingresos + lbEnPie * precioVentaLb - costo

    const dLb = previo ? lbEnPie - previo.lbEnPie : 0
    puntos.push({
      dia,
      fecha: sumarDias(lote.fechaInicio, dia),
      pesoLb,
      aves,
      lbEnPie,
      costo,
      ganancia,
      costoLbMarginal: previo && dLb > 0 ? (costo - previo.costo) / dLb : 0,
    })
    previo = puntos[puntos.length - 1]
  }

  const hoy = puntos[0]
  const optimo = puntos.reduce((mejor, p) => (p.ganancia > mejor.ganancia ? p : mejor), hoy)
  const cruce = puntos.find((p) => p.costoLbMarginal > precioVentaLb)

  // El óptimo puro puede caer en un pollo de 8 lb que ningún pollero paga a
  // precio de mercado, así que también se devuelve el mejor día sin pasarse del
  // peso que compra el cliente.
  const objetivoLb = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT
  const tope = puntos.find((p) => p.dia >= m.diaObjetivo) ?? hoy

  return {
    puntos,
    hoy,
    optimo,
    tope,
    excedeObjetivo: optimo.dia > tope.dia,
    objetivoLb,
    diaCruce: cruce?.dia,
    precioVentaLb,
    gananciaExtra: optimo.ganancia - hoy.ganancia,
  }
}
