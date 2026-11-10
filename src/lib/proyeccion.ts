import type { Gasto, Lote, Registro } from '../db/schema'
import { diaParaPesoDe, eficienciaAlimento, type LoteMetrics } from './metrics'
import { diasEntre, hoyISO, sumarDias } from './format'
import { computeInventarioAlimento } from './plan'
import { precioAlimentoLb } from './precios'
import { alimentoFuturo, alimentoPorTipo } from './alimentos'
import { pagoEmpleados, totalPorVenir } from './porPagar'
import { EN_PIE, type ModoVenta } from './venta'
import { bajasQueFaltan } from './ritmoBajas'
import { mezclaPorVender, type MezclaPorVender } from './mezcla'
import {
  LB_POR_QUINTAL,
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
  pesoEstandarLb,
  type FaseId,
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
  /** Lo que falta comprar de cada tipo de alimento, a su precio. */
  comprarPorTipo: { fase: FaseId; lb: number; precioQq?: number; costo?: number }[]
  sobranteLb: number
  /** Lo que valen, a lo que se pagaron, los sacos que sobrarían al vender. */
  sobranteValor?: number
  avesAlVender: number
  /** Las que se espera que se mueran de aquí a la venta, al ritmo del lote y de la granja. */
  bajasEsperadas: number
  /** Las que la granja suele vender aparte, por unidad o arregladas, y cuánto más dejan. */
  aparte?: MezclaPorVender
  /**
   * Cuánto más deja lo que falta por vender que todo al precio del ciclo, por
   * lo que se vende aparte: 1 si no se vende nada aparte.
   */
  factorPrecio: number
  /** Lo que se espera cobrar por lo que falta, si se sabe el precio. */
  ingresoPorVender?: number
  pesoVentaLb: number
  lbEnPie: number
  // Las libras que se cobran: las mismas en pie, o las arregladas si el pollo
  // se vende limpio, que son menos.
  lbVenta: number
  arreglado: boolean
  // Lo que falta por pagar hasta la venta: el alimento por comprar, lo que
  // queda del pago de los empleados, los gastos que ya se sabe que vienen y
  // arreglar las aves que faltan por vender. `costoRestante` es la suma.
  faltaAlimento: number
  faltaEmpleados: number
  faltaPorVenir: number
  faltaArreglo: number
  costoRestante: number
  /** No hay precio del alimento: lo que falta se estimó con el gasto por día del ciclo. */
  sinPrecioAlimento: boolean
  costoProyectado: number
  ingresoProyectado?: number
  gananciaProyectada?: number
  margenProyectadoPct?: number
  precioEquilibrioLb: number
  /**
   * Entre cuánto y cuánto puede pesar cada pollo al vender, con 8 de cada 10
   * de probabilidad: el margen de los pesajes y de los días que faltan.
   */
  pesoVentaRango?: [number, number]
  /** Lo mismo con la ganancia, si se sabe el precio. */
  gananciaRango?: [number, number]
  /** Vendiendo al llegar al peso: entre qué días llegarían. */
  diaVentaRango?: [number, number]
}

// Proyecta escalando la curva Cobb al rendimiento real del lote y descontando la
// mortalidad que todavía falta por ocurrir hasta el día de venta. Con `modo`,
// el pollo se cobra como se vende: arreglado, por libra limpia.
export function proyectarVenta(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
  objetivoLb: number,
  modo: ModoVenta = EN_PIE,
): Proyeccion | null {
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (!conPeso.length || m.avesVivas <= 0) return null

  const ultimo = conPeso[conPeso.length - 1]
  const diaUltimo = diasEntre(lote.fechaInicio, ultimo.fecha)
  // El peso de hoy, no el del último pesaje: pesadas a 5.4 lb hace cuatro días,
  // hoy van por 6.3. Antes decía «vender el 14-oct», que ya pasó, y ponía el
  // precio con un peso que ya no tienen. Y el que se cobra, el de la báscula
  // del pollero: la de la granja suele dar de más.
  const pesoActual = m.pesoAlVenderLb ?? m.pesoEstimadoLb ?? ultimo.pesoPromedio!
  // Con un día de venta fijo se vende ese día, al peso que lleven; si no, cuando
  // lleguen al peso de venta.
  const fijo = m.diaVentaFijo
  const listo = fijo != null ? m.dias >= fijo : pesoActual >= objetivoLb

  const pesoEn = (d: number) => m.estimador?.ventaEn(d) ?? pesoEstandarLb(d) * m.factorCurva
  const diaVenta = listo ? m.dias : (fijo ?? diaParaPesoDe(m, objetivoLb))
  if (!listo && fijo == null && pesoEn(diaVenta) < objetivoLb) return null

  const fechaEstimada = listo ? hoyISO() : sumarDias(lote.fechaInicio, diaVenta)
  const diasRestantes = diasEntre(hoyISO(), fechaEstimada)

  // La mortalidad que falta, sobre las aves que quedan: con 100 aves después
  // de una venta grande, contarla sobre las 1,000 del inicio mataba 18. Al
  // ritmo de este lote y de la granja, no al de cualquiera.
  const bajasEsperadas = listo ? 0 : bajasQueFaltan(m.avesVivas, m.ritmoBajas, diaVenta - m.dias)
  const avesAlVender = Math.max(0, m.avesVivas - bajasEsperadas)

  // El alimento que falta sale de la curva de consumo (que se dispara al final
  // del ciclo) escalada por lo ineficiente que va el lote: los días extra cuestan
  // proporcionalmente más de lo que engordan.
  const factorEf = eficienciaAlimento(m)
  const avesPromedio = (m.avesVivas + avesAlVender) / 2
  const desdeDia = Math.max(diaUltimo, m.dias)
  let alimentoRestanteLb = 0
  if (!listo) {
    const consumoStd = Math.max(0, alimentoAcumEstandarLb(diaVenta) - alimentoAcumEstandarLb(desdeDia))
    alimentoRestanteLb = Math.round(avesPromedio * consumoStd * factorEf)
  }

  const pesoVentaLb = listo
    ? pesoActual
    : fijo != null
      ? Math.max(pesoActual, pesoEn(fijo))
      : objetivoLb
  const lbEnPie = Math.round(avesAlVender * pesoVentaLb)
  const lbVenta = Math.round(lbEnPie * modo.rinde)

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
  const sobranteLb = Math.max(0, existenciaLb - alimentoRestanteLb)

  // Tipo por tipo: los sacos del almacén se dan en su orden y lo que falta se
  // compra del alimento que toca esos días, a lo que cuesta ese alimento. Antes
  // todo se pagaba al promedio de lo comprado, y el pre-inicio caro subía el
  // engorde que falta. Sin todas las compras con quintales, el almacén no
  // cuenta, igual que arriba.
  const porTipo = alimentoPorTipo(lote, registros, gastos, m)
  const futuro = alimentoFuturo(
    inventario?.completo ? porTipo : { ...porTipo, partidas: [] },
    desdeDia,
    listo ? desdeDia : diaVenta,
    (d) => avesPromedio * alimentoDiaEstandarLb(d) * factorEf,
  )
  const alimentoPorComprarLb = Math.max(0, alimentoRestanteLb - existenciaLb)

  // Lo de los empleados: lo que les toca hasta el día de venta, menos lo ya
  // anotado como mano de obra.
  const pago = pagoEmpleados(lote.empleados, gastos, { diaVenta, aves: m.vendidas + avesAlVender })

  // Sin precio del alimento, lo que falta se estima con lo que el ciclo lleva
  // gastando por día, sin los pollitos: se pagan una sola vez, y repartirlos
  // como si se pagaran a diario inflaba lo que falta y el precio mínimo. Lo de
  // arreglar el pollo ya vendido tampoco es de cada día, y la mano de obra, si
  // se dijo cuánto se paga, va en su renglón.
  const precioLb = precioAlimentoLb(lote, gastos, m)
  const pollitos =
    lote.costoInicial +
    gastos.filter((g) => g.categoria === 'aves').reduce((a, g) => a + g.monto, 0)
  const aparte = gastos
    .filter((g) => g.categoria === 'arreglo' || (pago && g.categoria === 'mano_obra'))
    .reduce((a, g) => a + g.monto, 0)
  const faltaAlimento =
    futuro.costo != null && futuro.comprarLb > 0
      ? futuro.costo * (alimentoPorComprarLb / futuro.comprarLb)
      : alimentoPorComprarLb <= 0
        ? 0
        : precioLb
    ? alimentoPorComprarLb * precioLb
    : m.dias > 0
      ? (Math.max(0, m.costos - pollitos - aparte) / m.dias) * diasRestantes
      : 0
  const faltaEmpleados = pago?.falta ?? 0
  const faltaPorVenir = totalPorVenir(lote)
  const faltaArreglo = avesAlVender * modo.costoAve
  const costoRestante = faltaAlimento + faltaEmpleados + faltaPorVenir + faltaArreglo
  const costoProyectado = m.costos + costoRestante

  // Lo que falta se cobra como vende la granja: casi todo al precio del ciclo,
  // y lo que suele vender aparte, a lo que lo vende.
  const precio = lote.precioVentaLb
  const ventaAparte = precio
    ? mezclaPorVender(m.perfil?.mezcla, m.vendidas, m.vendidasAparte, avesAlVender)
    : undefined
  const factorPrecio = ventaAparte?.factor ?? 1
  const ingresoPorVender = precio ? lbVenta * precio * factorPrecio : undefined
  const ingresoProyectado = ingresoPorVender != null ? m.ingresos + ingresoPorVender : undefined
  const gananciaProyectada = ingresoProyectado != null ? ingresoProyectado - costoProyectado : undefined
  const margenProyectadoPct =
    ingresoProyectado && ingresoProyectado > 0
      ? (gananciaProyectada! / ingresoProyectado) * 100
      : undefined

  // El margen: con día de venta, en el peso y la ganancia; vendiendo al llegar
  // al peso, en el día.
  let pesoVentaRango: [number, number] | undefined
  let gananciaRango: [number, number] | undefined
  let diaVentaRango: [number, number] | undefined
  if (m.estimador) {
    if (listo || fijo != null) {
      const [bajo, alto] = m.estimador.rangoVentaEn(listo ? m.dias : diaVenta)
      pesoVentaRango = [Math.min(bajo, pesoVentaLb), Math.max(alto, pesoVentaLb)]
      if (gananciaProyectada != null && precio) {
        const porLibra = avesAlVender * modo.rinde * precio * factorPrecio
        gananciaRango = [
          gananciaProyectada - (pesoVentaLb - pesoVentaRango[0]) * porLibra,
          gananciaProyectada + (pesoVentaRango[1] - pesoVentaLb) * porLibra,
        ]
      }
    } else {
      const primero = (f: (d: number) => number) => {
        for (let d = Math.max(1, m.dias); d <= 84; d++) if (f(d) >= objetivoLb) return d
        return 84
      }
      diaVentaRango = [
        primero((d) => m.estimador!.rangoVentaEn(d)[1]),
        primero((d) => m.estimador!.rangoVentaEn(d)[0]),
      ]
    }
  }

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
    comprarPorTipo: futuro.comprar,
    sobranteLb,
    sobranteValor: sobranteLb > 0 ? futuro.sobranteValor : undefined,
    avesAlVender,
    bajasEsperadas,
    ...(ventaAparte ? { aparte: ventaAparte } : {}),
    factorPrecio,
    ...(ingresoPorVender != null ? { ingresoPorVender } : {}),
    pesoVentaLb,
    lbEnPie,
    lbVenta,
    arreglado: modo.arreglado,
    faltaAlimento,
    faltaEmpleados,
    faltaPorVenir,
    faltaArreglo,
    costoRestante,
    sinPrecioAlimento: !precioLb && futuro.costo == null,
    costoProyectado,
    ingresoProyectado,
    gananciaProyectada,
    margenProyectadoPct,
    precioEquilibrioLb: lbVenta > 0 ? costoProyectado / lbVenta : 0,
    pesoVentaRango,
    gananciaRango,
    diaVentaRango,
  }
}
