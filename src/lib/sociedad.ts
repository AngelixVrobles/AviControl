import type { Gasto, Ingreso, Lote, Socio } from '../db/schema'
import type { LoteMetrics } from './metrics'

export interface SocioBalance {
  nombre: string
  pct: number
  aporte: number
  cobrado: number
  corresponde: number
  ajuste: number
}

export interface Traspaso {
  de: string
  a: string
  monto: number
}

export interface Liquidacion {
  socios: SocioBalance[]
  ganancia: number
  traspasos: Traspaso[]
}

const norm = (socios: Socio[]): number[] => {
  const total = socios.reduce((a, s) => a + (s.pct || 0), 0)
  return total > 0 ? socios.map((s) => (s.pct || 0) / total) : socios.map(() => 1 / socios.length)
}

export function computeLiquidacion(
  lote: Lote,
  gastos: Gasto[],
  ingresos: Ingreso[],
  m: LoteMetrics,
): Liquidacion | null {
  const socios = lote.socios
  if (!socios || socios.length < 2) return null

  const fr = norm(socios)
  const aporte = socios.map(() => 0)
  const cobrado = socios.map(() => 0)

  const repartir = (destino: number[], monto: number, quien: number | undefined) => {
    if (quien != null && quien >= 0 && quien < destino.length) destino[quien] += monto
    else fr.forEach((f, i) => (destino[i] += monto * f))
  }

  repartir(aporte, lote.costoInicial, lote.costoInicialPagadoPor)
  for (const g of gastos) repartir(aporte, g.monto, g.pagadoPor)
  for (const i of ingresos) repartir(cobrado, i.monto, i.recibidoPor)

  const balances: SocioBalance[] = socios.map((s, i) => {
    const corresponde = fr[i] * m.ganancia
    return {
      nombre: s.nombre,
      pct: fr[i] * 100,
      aporte: aporte[i],
      cobrado: cobrado[i],
      corresponde,
      ajuste: corresponde - (cobrado[i] - aporte[i]),
    }
  })

  return { socios: balances, ganancia: m.ganancia, traspasos: liquidar(balances) }
}

// Salda los ajustes: quien tiene ajuste negativo le paga a quien lo tiene positivo.
function liquidar(balances: SocioBalance[]): Traspaso[] {
  const deben = balances.map((b, i) => ({ i, x: b.ajuste })).filter((b) => Math.abs(b.x) >= 1)
  const acreedores = deben.filter((b) => b.x > 0).sort((a, b) => b.x - a.x)
  const deudores = deben.filter((b) => b.x < 0).map((b) => ({ ...b, x: -b.x })).sort((a, b) => b.x - a.x)

  const out: Traspaso[] = []
  let ai = 0
  for (const d of deudores) {
    let resto = d.x
    while (resto >= 1 && ai < acreedores.length) {
      const a = acreedores[ai]
      const monto = Math.min(resto, a.x)
      out.push({ de: balances[d.i].nombre, a: balances[a.i].nombre, monto: Math.round(monto) })
      resto -= monto
      a.x -= monto
      if (a.x < 1) ai++
    }
  }
  return out
}
