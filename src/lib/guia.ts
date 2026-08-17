import type { Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import {
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
  avesPorM2,
  fcaEstandar,
  mortalidadEsperadaPct,
  pesoEstandarLb,
  tempRecomendadaC,
} from './standards'

export interface GuiaDia {
  dia: number
  pesoObjetivoLb: number
  pesoRealLb?: number
  pesoEstimado: boolean
  diasDesdePeso?: number
  desviacionPct?: number
  alimentoAcumLb: number
  alimentoDiaLb: number
  fcaEsperado: number
  aguaLitrosDia: number
  areaM2: number
  tempC: number
  mortalidadEsperadaPct: number
}

export function computeGuiaDia(lote: Lote, m: LoteMetrics): GuiaDia | null {
  if (lote.tipo !== 'engorde' || lote.estado !== 'activo') return null

  const dia = m.dias
  const aves = m.avesVivas > 0 ? m.avesVivas : lote.cantidadInicial

  const pesoObjetivoLb = pesoEstandarLb(dia)
  const pesoRealLb = m.pesoEstimadoLb
  const desviacionPct =
    pesoRealLb != null && pesoObjetivoLb > 0
      ? ((pesoRealLb - pesoObjetivoLb) / pesoObjetivoLb) * 100
      : undefined

  const alimentoDiaLb = alimentoDiaEstandarLb(dia) * aves

  return {
    dia,
    pesoObjetivoLb,
    pesoRealLb,
    pesoEstimado: (m.diasDesdePeso ?? 0) >= 2,
    diasDesdePeso: m.diasDesdePeso,
    desviacionPct,
    alimentoAcumLb: alimentoAcumEstandarLb(dia) * aves,
    alimentoDiaLb,
    // Un pollo bebe cerca del doble de lo que come; en el calor dominicano sube más.
    aguaLitrosDia: alimentoDiaLb * 0.82,
    areaM2: aves / avesPorM2(pesoRealLb ?? pesoObjetivoLb),
    tempC: tempRecomendadaC(dia),
    mortalidadEsperadaPct: mortalidadEsperadaPct(dia),
    fcaEsperado: fcaEstandar(dia),
  }
}
