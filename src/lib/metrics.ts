import type { Gasto, Ingreso, Lote, Registro } from '../db/schema'
import { diasDesde, diasEntre, hoyISO, sumarDias } from './format'
import { KG_POR_LB, PESO_OBJETIVO_DEFAULT, diaParaPeso, pesoEstandarLb } from './standards'

export interface LoteMetrics {
  dias: number
  ultimaFecha?: string
  cantidadInicial: number
  bajas: number
  vendidas: number
  avesVivas: number
  mortalidadPct: number
  alimentoTotalLb: number
  costos: number
  ingresos: number
  ganancia: number
  margenPct: number
  costoPorAve: number

  pesoPromedioLb?: number
  biomasaLb?: number
  fca?: number
  costoPorLb?: number
  gananciaPorLb?: number
  iep?: number
  factorCurva: number

  diaObjetivo: number
  diaVentaEstimado?: number
  fechaVentaEstimada?: string

  registroHoy?: { pesoPromedio?: number; alimentoLb: number; mortalidad: number }
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
  const avesVivas = Math.max(0, lote.cantidadInicial - bajas - descartes - vendidas)
  const mortalidadPct = lote.cantidadInicial > 0 ? (bajas / lote.cantidadInicial) * 100 : 0

  const alimentoTotalLb = sum(registros.map((r) => r.alimentoLb ?? 0))
  const costos = lote.costoInicial + sum(gastos.map((g) => g.monto))
  const ingresosTot = sum(ingresos.map((i) => i.monto))
  const ganancia = ingresosTot - costos
  const margenPct = ingresosTot > 0 ? (ganancia / ingresosTot) * 100 : 0
  const costoPorAve = lote.cantidadInicial > 0 ? costos / lote.cantidadInicial : 0

  const rHoy = registros.find((r) => r.fecha === hoyISO())

  const base = {
    dias,
    registroHoy: rHoy
      ? { pesoPromedio: rHoy.pesoPromedio, alimentoLb: rHoy.alimentoLb, mortalidad: rHoy.mortalidad + rHoy.descarte }
      : undefined,
    ultimaFecha: registros.length ? registros[registros.length - 1].fecha : undefined,
    cantidadInicial: lote.cantidadInicial,
    bajas: bajas + descartes,
    vendidas,
    avesVivas,
    mortalidadPct,
    alimentoTotalLb,
    costos,
    ingresos: ingresosTot,
    ganancia,
    margenPct,
    costoPorAve,
  }

  const pesoObjetivo = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT

  const conPeso = registros.filter((r) => typeof r.pesoPromedio === 'number')
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
  const pesoVendidoLb = sum(ingresos.filter((i) => i.tipo === 'aves').map((i) => i.pesoLb ?? 0))
  const biomasaViva = pesoPromedioLb ? avesVivas * pesoPromedioLb : 0
  const biomasaLb = biomasaViva + pesoVendidoLb
  const fca = biomasaLb > 0 ? alimentoTotalLb / biomasaLb : undefined
  const costoPorLb = biomasaLb > 0 ? costos / biomasaLb : undefined
  const gananciaPorLb = biomasaLb > 0 ? ganancia / biomasaLb : undefined

  // Índice de eficiencia productiva europeo (EPEF/IEP), rango típico 250–400.
  const iep =
    pesoPromedioLb != null && fca != null && fca > 0 && dias > 0
      ? (((100 - mortalidadPct) * (pesoPromedioLb * KG_POR_LB)) / (dias * fca)) * 100
      : undefined

  let diaVentaEstimado: number | undefined
  let fechaVentaEstimada: string | undefined
  if (pesoPromedioLb != null && avesVivas > 0) {
    if (pesoPromedioLb >= pesoObjetivo) {
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
