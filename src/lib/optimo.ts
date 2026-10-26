import type { Gasto, Lote, Registro } from '../db/schema'
import { eficienciaAlimento, type LoteMetrics } from './metrics'
import { diasEntre, sumarDias } from './format'
import { pesoObjetivoDe } from './lote'
import { precioAlimentoLb } from './precios'
import { proyectarVenta } from './proyeccion'
import { pagoEmpleados, totalPorVenir } from './porPagar'
import { EN_PIE, type ModoVenta } from './venta'
import {
  alimentoAcumEstandarLb,
  mortalidadEsperadaPct,
  pesoEstandarLb,
} from './standards'

export interface PuntoVenta {
  dia: number
  fecha: string
  pesoLb: number
  aves: number
  lbEnPie: number
  /** Las libras que se cobran: en pie, o arregladas. */
  lbVenta: number
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
// de la última libra contra el precio de venta. Cada día de más también es un
// día más de sueldo, si a los empleados se les paga por tiempo.
export function analizarPuntoOptimo(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
  modo: ModoVenta = EN_PIE,
): AnalisisOptimo | null {
  const precioVentaLb = lote.precioVentaLb
  const precioAlim = precioAlimentoLb(lote, gastos, m)
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!precioVentaLb || !precioAlim || !conPeso.length || m.avesVivas <= 0) return null

  const diaUltimo = diasEntre(lote.fechaInicio, conPeso[conPeso.length - 1].fecha)
  const factorEf = eficienciaAlimento(m)
  const desde = Math.max(m.dias, diaUltimo)
  const objetivoLb = pesoObjetivoDe(lote)

  // El alimento del almacén que se va a comer hasta la venta ya está pagado.
  // Se descuenta igual en todos los días, así que no mueve el mejor día ni lo
  // que cuesta la libra de más —comerlo hoy o guardarlo para el próximo ciclo
  // vale lo mismo—, pero la ganancia del día de venta queda igual que la de
  // «A cómo vender» en vez de cobrar dos veces esos sacos.
  const p = proyectarVenta(lote, registros, gastos, m, objetivoLb, modo)
  const usadoDelAlmacenLb = p ? Math.min(p.existenciaLb, p.alimentoRestanteLb) : 0
  const porVenir = totalPorVenir(lote)

  const puntos: PuntoVenta[] = []
  let previo: PuntoVenta | undefined
  // Pasado el día 56 ya no hay curva que recorrer: queda solo hoy, y lo que
  // toca es vender. Antes el recorrido quedaba vacío y la pestaña se caía.
  const hasta = Math.max(desde, Math.min(56, desde + HORIZONTE_DIAS))
  for (let dia = desde; dia <= hasta; dia++) {
    const pesoLb = pesoEstandarLb(dia) * m.factorCurva
    const bajas = Math.round(
      (m.avesVivas * Math.max(0, mortalidadEsperadaPct(dia) - mortalidadEsperadaPct(desde))) / 100,
    )
    const aves = Math.max(0, m.avesVivas - bajas)
    const avesPromedio = (m.avesVivas + aves) / 2
    const consumo = Math.max(0, alimentoAcumEstandarLb(dia) - alimentoAcumEstandarLb(desde))
    const empleados =
      pagoEmpleados(lote.empleados, gastos, { diaVenta: dia, aves: m.vendidas + aves })?.falta ?? 0
    const costo =
      m.costos +
      (consumo * avesPromedio * factorEf - usadoDelAlmacenLb) * precioAlim +
      empleados +
      porVenir +
      aves * modo.costoAve
    const lbEnPie = aves * pesoLb
    const lbVenta = lbEnPie * modo.rinde
    const ganancia = m.ingresos + lbVenta * precioVentaLb - costo

    const dLb = previo ? lbVenta - previo.lbVenta : 0
    puntos.push({
      dia,
      fecha: sumarDias(lote.fechaInicio, dia),
      pesoLb,
      aves,
      lbEnPie,
      lbVenta,
      costo,
      ganancia,
      costoLbMarginal: previo && dLb > 0 ? (costo - previo.costo) / dLb : 0,
    })
    previo = puntos[puntos.length - 1]
  }

  if (!puntos.length) return null
  const hoy = puntos[0]
  const optimo = puntos.reduce((mejor, p) => (p.ganancia > mejor.ganancia ? p : mejor), hoy)
  const cruce = puntos.find((p) => p.costoLbMarginal > precioVentaLb)

  // El óptimo puro puede caer en un pollo de 8 lb que ningún pollero paga a
  // precio de mercado, así que también se devuelve el mejor día sin pasarse del
  // peso que compra el cliente.
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
