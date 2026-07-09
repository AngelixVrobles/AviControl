import type { Gasto, Ingreso, Lote, Registro } from '../db/schema'
import { diasDesde, diasEntre } from './format'

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

  huevosTotal?: number
  huevosHoy?: number
  posturaPct?: number
  costoPorHuevo?: number
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

  const base: LoteMetrics = {
    dias,
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

  if (lote.tipo === 'engorde') {
    const conPeso = registros.filter((r) => typeof r.pesoPromedio === 'number')
    const pesoPromedioLb = conPeso.length
      ? conPeso[conPeso.length - 1].pesoPromedio!
      : undefined
    const pesoVendidoLb = sum(ingresos.filter((i) => i.tipo === 'aves').map((i) => i.pesoLb ?? 0))
    const biomasaViva = pesoPromedioLb ? avesVivas * pesoPromedioLb : 0
    const biomasaLb = biomasaViva + pesoVendidoLb
    const fca = biomasaLb > 0 ? alimentoTotalLb / biomasaLb : undefined
    const costoPorLb = biomasaLb > 0 ? costos / biomasaLb : undefined
    const gananciaPorLb = biomasaLb > 0 ? ganancia / biomasaLb : undefined
    return { ...base, pesoPromedioLb, biomasaLb, fca, costoPorLb, gananciaPorLb }
  }

  const huevosTotal = sum(registros.map((r) => r.huevos ?? 0))
  const ultimoDia = registros.length
    ? [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    : undefined
  const huevosHoy = ultimoDia?.huevos ?? 0
  const posturaPct = avesVivas > 0 ? (huevosHoy / avesVivas) * 100 : 0
  const costoPorHuevo = huevosTotal > 0 ? costos / huevosTotal : undefined
  return { ...base, huevosTotal, huevosHoy, posturaPct, costoPorHuevo }
}

export interface SemanaResumen {
  semana: number
  mortalidad: number
  alimentoLb: number
  pesoFinal?: number
  huevos: number
}

export function resumenSemanal(lote: Lote, registros: Registro[]): SemanaResumen[] {
  const semanas = new Map<number, SemanaResumen>()
  for (const r of registros) {
    const n = Math.floor(diasEntre(lote.fechaInicio, r.fecha) / 7) + 1
    const s = semanas.get(n) ?? { semana: n, mortalidad: 0, alimentoLb: 0, huevos: 0 }
    s.mortalidad += r.mortalidad + r.descarte
    s.alimentoLb += r.alimentoLb
    s.huevos += r.huevos ?? 0
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
