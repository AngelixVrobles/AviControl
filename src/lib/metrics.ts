import type { Gasto, Ingreso, Lote, Registro } from '../db/schema'
import { consumoAlimento, type ConsumoAlimento } from './consumo'
import { diasDesde, diasEntre, hoyISO, sumarDias } from './format'
import { pendienteDe } from './cobros'
import { pesoObjetivoDe } from './lote'
import { KG_POR_LB, diaParaPeso, fcaEstandar, pesoEstandarLb } from './standards'

export interface LoteMetrics {
  dias: number
  ultimaFecha?: string
  cantidadInicial: number
  bajas: number
  vendidas: number
  avesVivas: number
  /** Muertas sobre las aves que entraron (sin las que llegaron muertas). */
  mortalidadPct: number
  /** Descartadas sobre las aves que entraron. */
  descartePct: number
  alimentoTotalLb: number
  // De dónde sale el alimento: lo anotado cada día más lo que dicen los conteos
  // de sacos. `diaAlimento` es el último día con dato, y a ese día se mide el FCA.
  alimento: ConsumoAlimento
  diaAlimento?: number
  costos: number
  ingresos: number
  /** De lo vendido a crédito, lo que el comprador todavía no paga. */
  porCobrar: number
  ganancia: number
  margenPct: number
  costoPorAve: number

  pesoPromedioLb?: number
  fechaPeso?: string
  diasDesdePeso?: number
  pesoEstimadoLb?: number
  /** Lo que pesó cada ave vendida: libras de la báscula entre aves, de las ventas con peso. */
  pesoVentaLb?: number
  /** El peso con que se juzga el ciclo: el de venta si ya cerró, el estimado de hoy si sigue. */
  pesoFinalLb?: number
  /** Las libras que ya salieron vendidas: las de la báscula, y las vendidas por cabeza al peso del lote ese día. */
  lbVendidas: number
  biomasaLb?: number
  fca?: number
  costoPorLb?: number
  gananciaPorLb?: number
  iep?: number
  factorCurva: number

  diaObjetivo: number
  diaVentaEstimado?: number
  fechaVentaEstimada?: string

  registroHoy?: {
    pesoPromedio?: number
    alimentoLb: number
    aguaL?: number
    tempMaxC?: number
    mortalidad: number
  }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function computeMetrics(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  ingresos: Ingreso[],
): LoteMetrics {
  const dias = lote.fechaCierre
    ? diasEntre(lote.fechaInicio, lote.fechaCierre)
    : diasDesde(lote.fechaInicio)
  const bajas = sum(registros.map((r) => r.mortalidad ?? 0))
  const descartes = sum(registros.map((r) => r.descarte ?? 0))
  const vendidas = sum(ingresos.filter((i) => i.tipo === 'aves').map((i) => i.cantidad))
  // Los que llegaron muertos en las cajas no entraron al galpón: no están vivos,
  // pero tampoco son mortalidad de la granja.
  const colocados = Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0))
  const avesVivas = Math.max(0, colocados - bajas - descartes - vendidas)
  // La mortalidad es la de las aves que entraron al galpón, en toda la app: la
  // tarjeta, la ficha Aves, Reportes y el Excel. Antes la ficha contaba los
  // descartes y la tarjeta no, y con 20 muertas y 30 descartadas una decía 2 %
  // y la otra 5 %. Los descartes se llevan aparte.
  const mortalidadPct = colocados > 0 ? (bajas / colocados) * 100 : 0
  const descartePct = colocados > 0 ? (descartes / colocados) * 100 : 0

  const alimento = consumoAlimento(lote, registros, gastos)
  const alimentoTotalLb = alimento.totalLb
  const costos = lote.costoInicial + sum(gastos.map((g) => g.monto))
  // Lo vendido cuenta en la ganancia aunque se venda a crédito: el pollo ya
  // salió. Lo que falta por cobrar se lleva aparte.
  const ingresosTot = sum(ingresos.map((i) => i.monto))
  const porCobrar = sum(ingresos.map(pendienteDe))
  const ganancia = ingresosTot - costos
  const margenPct = ingresosTot > 0 ? (ganancia / ingresosTot) * 100 : 0
  const costoPorAve = lote.cantidadInicial > 0 ? costos / lote.cantidadInicial : 0

  // El día creado por un pesaje no es el registro de hoy: le faltan las bajas y
  // el alimento.
  const rHoy = registros.find((r) => r.fecha === hoyISO() && !r.soloPeso)

  const base = {
    dias,
    registroHoy: rHoy
      ? {
          pesoPromedio: rHoy.pesoPromedio,
          alimentoLb: rHoy.alimentoLb,
          aguaL: rHoy.aguaL,
          tempMaxC: rHoy.tempMaxC,
          mortalidad: rHoy.mortalidad + rHoy.descarte,
        }
      : undefined,
    ultimaFecha: registros.length ? registros[registros.length - 1].fecha : undefined,
    cantidadInicial: lote.cantidadInicial,
    bajas: bajas + descartes,
    vendidas,
    avesVivas,
    mortalidadPct,
    descartePct,
    alimentoTotalLb,
    alimento,
    diaAlimento: alimento.hastaDia,
    costos,
    ingresos: ingresosTot,
    porCobrar,
    ganancia,
    margenPct,
    costoPorAve,
  }

  const pesoObjetivo = pesoObjetivoDe(lote)

  const conPeso = registros.filter((r) => Number.isFinite(r.pesoPromedio))
  const ultimoPeso = conPeso.length ? conPeso[conPeso.length - 1] : undefined
  const pesoPromedioLb = ultimoPeso?.pesoPromedio

  // Todo lo que se proyecta se apoya en la curva Cobb escalada al rendimiento
  // real del lote, no en la curva cruda: un lote al 90 % del estándar tarda más
  // en llegar al peso de venta y hay que decirlo desde el primer pesaje.
  const factorCurva =
    pesoPromedioLb != null && ultimoPeso
      ? pesoPromedioLb / pesoEstandarLb(diasEntre(lote.fechaInicio, ultimoPeso.fecha))
      : 1
  const diaObjetivo = diaParaPeso(pesoObjetivo, factorCurva)

  // Un peso medido envejece: a los tres días ya no es el del galpón. Se proyecta
  // a hoy con la misma curva escalada, porque si no el alimento de esos días se
  // divide entre la biomasa de entonces y el FCA, el costo por libra y el IEP
  // salen disparados sin que nada haya pasado.
  const fechaCorte = lote.fechaCierre ?? hoyISO()
  const diasDesdePeso = ultimoPeso ? diasEntre(ultimoPeso.fecha, fechaCorte) : undefined
  const diaPeso = ultimoPeso ? diasEntre(lote.fechaInicio, ultimoPeso.fecha) : 0
  const pesoEnDia = (d: number) =>
    pesoPromedioLb == null
      ? undefined
      : d >= diaPeso
        ? Math.max(pesoPromedioLb, pesoEstandarLb(d) * factorCurva)
        : pesoEstandarLb(d) * factorCurva
  const pesoEstimadoLb = pesoEnDia(dias)

  // Lo vendido por cabeza, sin pesar, pesaba lo que el lote ese día. Antes
  // contaba como cero libras: las aves salían del galpón pero su peso no
  // entraba en ninguna parte, y la conversión, el costo por libra y el IEP se
  // iban al doble.
  const pesoVendidoLb = sum(
    ingresos
      .filter((i) => i.tipo === 'aves')
      .map((i) => {
        if ((i.pesoLb ?? 0) > 0) return i.pesoLb!
        if (!(i.cantidad > 0)) return 0
        return i.cantidad * (pesoEnDia(diasEntre(lote.fechaInicio, i.fecha)) ?? 0)
      }),
  )
  const biomasaViva = pesoEstimadoLb ? avesVivas * pesoEstimadoLb : 0
  const biomasaLb = biomasaViva + pesoVendidoLb

  // Sin alimento anotado no hay conversión: antes salía 0.00, que se lee como
  // un lote perfecto. Y si el último dato de alimento es de hace días, el FCA se
  // mide contra el peso de ese día: dividir el alimento de hasta el día 14 entre
  // el peso del día 20 da una conversión que no existe.
  const pesoAlimentoLb =
    alimento.hastaDia != null ? pesoEnDia(Math.min(alimento.hastaDia, dias)) : undefined
  const biomasaAlimento = (pesoAlimentoLb ? avesVivas * pesoAlimentoLb : 0) + pesoVendidoLb
  const fca = alimentoTotalLb > 0 && biomasaAlimento > 0 ? alimentoTotalLb / biomasaAlimento : undefined
  const costoPorLb = biomasaLb > 0 ? costos / biomasaLb : undefined
  const gananciaPorLb = biomasaLb > 0 ? ganancia / biomasaLb : undefined

  // El peso de un ciclo cerrado es el de la báscula al vender, no el del último
  // pesaje proyectado al cierre: la comparación entre ciclos y el IEP se hacían
  // con un peso que nadie cobró.
  const ventasConPeso = ingresos.filter(
    (i) => i.tipo === 'aves' && (i.pesoLb ?? 0) > 0 && i.cantidad > 0,
  )
  const avesConPeso = sum(ventasConPeso.map((i) => i.cantidad))
  const pesoVentaLb =
    avesConPeso > 0 ? sum(ventasConPeso.map((i) => i.pesoLb!)) / avesConPeso : undefined
  const pesoFinalLb =
    lote.estado === 'cerrado' && pesoVentaLb != null ? pesoVentaLb : pesoEstimadoLb

  // Índice de eficiencia productiva europeo (EPEF/IEP), rango típico 250–400.
  const iep =
    pesoFinalLb != null && fca != null && fca > 0 && dias > 0
      ? (((100 - mortalidadPct - descartePct) * (pesoFinalLb * KG_POR_LB)) / (dias * fca)) * 100
      : undefined

  let diaVentaEstimado: number | undefined
  let fechaVentaEstimada: string | undefined
  if (pesoEstimadoLb != null && avesVivas > 0) {
    if (pesoEstimadoLb >= pesoObjetivo) {
      diaVentaEstimado = dias
      fechaVentaEstimada = hoyISO()
    } else {
      const d = diaParaPeso(pesoObjetivo, factorCurva)
      if (pesoEstandarLb(d) * factorCurva >= pesoObjetivo) {
        diaVentaEstimado = d
        fechaVentaEstimada = sumarDias(lote.fechaInicio, d)
      }
    }
  }

  return {
    ...base,
    pesoPromedioLb,
    fechaPeso: ultimoPeso?.fecha,
    diasDesdePeso,
    pesoEstimadoLb,
    pesoVentaLb,
    pesoFinalLb,
    lbVendidas: pesoVendidoLb,
    biomasaLb,
    fca,
    costoPorLb,
    gananciaPorLb,
    iep,
    factorCurva,
    diaObjetivo,
    diaVentaEstimado,
    fechaVentaEstimada,
  }
}

// `temprano`: antes del día 7 el pollito pesa gramos y el alimento del recibo
// (los comederos llenos) pesa más que todo lo que se comió: la conversión de
// esos días no dice nada y no se juzga.
export type EstadoFca = 'bien' | 'alto' | 'dudosoBajo' | 'dudosoAlto' | 'temprano'

// Cómo va la conversión. Se mide al último día con dato de alimento, así que se
// compara con el estándar Cobb de ese mismo día y no con el de hoy: el estándar
// sube con la edad, y medir el FCA del día 14 contra el del 24 lo hacía ver
// mejor de lo que iba. Ningún lote de campo convierte un cuarto mejor que la
// genética, ni el doble de mal sin que se note en todo lo demás: un FCA así
// casi siempre es alimento sin anotar (muy bajo) o anotado de más, libras por
// sacos (muy alto), y no se puede dar por bueno ni usar para proyectar.
export function juicioFca(
  m: Pick<LoteMetrics, 'fca' | 'diaAlimento' | 'dias'>,
): { dia: number; estandar: number; estado: EstadoFca } | undefined {
  if (m.fca == null) return undefined
  const dia = Math.min(m.diaAlimento ?? m.dias, m.dias)
  const estandar = fcaEstandar(dia)
  if (dia < 7 || !(estandar > 0)) return { dia, estandar, estado: 'temprano' }
  if (dia >= 7 && m.fca < estandar * 0.75) return { dia, estandar, estado: 'dudosoBajo' }
  if (dia >= 7 && m.fca > estandar * 2) return { dia, estandar, estado: 'dudosoAlto' }
  return { dia, estandar, estado: m.fca > estandar + 0.1 ? 'alto' : 'bien' }
}

export const fcaDudoso = (m: Pick<LoteMetrics, 'fca' | 'diaAlimento' | 'dias'>) => {
  const e = juicioFca(m)?.estado
  return e === 'dudosoBajo' || e === 'dudosoAlto'
}

// Qué tanto peor (o mejor) que el estándar convierte el lote, para escalar el
// consumo que viene. Un FCA dudoso no escala nada: con uno bajísimo el alimento
// que falta salía casi gratis y el precio mínimo, más bajo de lo real. Antes del
// día 7 tampoco: con el alimento anotado solo el día que llegaron, el estándar
// del día 0 es cero y el precio mínimo salía «RD$∞».
export function eficienciaAlimento(m: LoteMetrics): number {
  const j = juicioFca(m)
  if (!j || j.estado === 'temprano' || !m.fca || m.fca <= 0.5 || fcaDudoso(m)) return 1
  return m.fca / j.estandar
}

export interface SemanaResumen {
  semana: number
  mortalidad: number
  alimentoLb: number
  pesoFinal?: number
}

export function resumenSemanal(lote: Lote, registros: Registro[]): SemanaResumen[] {
  const semanas = new Map<number, SemanaResumen>()
  for (const r of registros) {
    const n = Math.floor(diasEntre(lote.fechaInicio, r.fecha) / 7) + 1
    const s = semanas.get(n) ?? { semana: n, mortalidad: 0, alimentoLb: 0 }
    s.mortalidad += r.mortalidad + r.descarte
    s.alimentoLb += r.alimentoLb
    if (r.pesoPromedio != null) s.pesoFinal = r.pesoPromedio
    semanas.set(n, s)
  }
  return [...semanas.values()].sort((a, b) => a.semana - b.semana)
}

export function agruparGastos(gastos: Gasto[]): { categoria: string; total: number }[] {
  const map = new Map<string, number>()
  for (const g of gastos) map.set(g.categoria, (map.get(g.categoria) ?? 0) + g.monto)
  return [...map.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
}
