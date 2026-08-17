import type { LoteMetrics } from './metrics'
import { fcaEstandar, mortalidadEsperadaPct, pesoEstandarLb } from './standards'
import { num, pct } from './format'

export interface Desviacion {
  valor: string
  detalle: string
  estado: 'bien' | 'mal'
}

// Compara los tres indicadores clave contra la curva Cobb500. La tolerancia es
// de 5 %: la tabla del suplemento es potencial genético en galpón controlado, y
// un lote de campo que ande al 95 % va bien, no mal.
export function desviaciones(m: LoteMetrics): {
  peso: Desviacion
  fca: Desviacion
  mortalidad: Desviacion
} {
  const dia = m.dias
  const pesoStd = pesoEstandarLb(dia)

  const peso = ((): Desviacion => {
    if (m.pesoEstimadoLb == null) return { valor: '—', detalle: 'sin pesar', estado: 'bien' }
    const dif = ((m.pesoEstimadoLb - pesoStd) / pesoStd) * 100
    const valor = `${num(m.pesoEstimadoLb, 2)} lb`
    if (dif < -5) return { valor, detalle: `▼ ${num(-dif, 0)}% peso`, estado: 'mal' }
    if (dif > 5) return { valor, detalle: `▲ ${num(dif, 0)}% peso`, estado: 'bien' }
    return { valor, detalle: '✓ en peso', estado: 'bien' }
  })()

  const fca = ((): Desviacion => {
    if (m.fca == null) return { valor: '—', detalle: 'FCA', estado: 'bien' }
    const dif = m.fca - fcaEstandar(dia)
    if (dif > 0.1) return { valor: num(m.fca, 2), detalle: `▲ ${num(dif, 2)} FCA`, estado: 'mal' }
    return { valor: num(m.fca, 2), detalle: '✓ FCA', estado: 'bien' }
  })()

  const mortalidad = ((): Desviacion => {
    if (m.mortalidadPct > mortalidadEsperadaPct(dia) + 0.5)
      return { valor: pct(m.mortalidadPct, 1), detalle: '▲ mortalidad', estado: 'mal' }
    return { valor: pct(m.mortalidadPct, 1), detalle: '✓ mortalidad', estado: 'bien' }
  })()

  return { peso, fca, mortalidad }
}

export const pctDelEstandar = (m: LoteMetrics) =>
  m.pesoEstimadoLb != null ? (m.pesoEstimadoLb / pesoEstandarLb(m.dias)) * 100 : undefined
