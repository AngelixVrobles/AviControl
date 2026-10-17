import { juicioFca, type LoteMetrics } from './metrics'
import { mortalidadEsperadaPct, pesoEstandarLb } from './standards'
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

  // Contra el estándar del día en que se midió, y sin dar por buena una
  // conversión imposible: un 0.05 salía con «✓ FCA».
  const fca = ((): Desviacion => {
    const j = juicioFca(m)
    if (m.fca == null || !j) return { valor: '—', detalle: 'FCA', estado: 'bien' }
    const valor = num(m.fca, 2)
    if (j.estado === 'dudosoBajo') return { valor, detalle: 'falta alimento', estado: 'mal' }
    if (j.estado === 'dudosoAlto') return { valor, detalle: 'revisa alimento', estado: 'mal' }
    if (j.estado === 'alto')
      return { valor, detalle: `▲ ${num(m.fca - j.estandar, 2)} FCA`, estado: 'mal' }
    return { valor, detalle: '✓ FCA', estado: 'bien' }
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
