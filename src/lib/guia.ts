import type { Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import {
  AVES_POR_M2,
  RAZA_DEFAULT,
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
  mortalidadEsperadaPct,
  pesoEstandarLb,
  tempRecomendadaC,
} from './standards'

export interface GuiaDia {
  dia: number
  pesoObjetivoLb: number
  pesoRealLb?: number
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

  const raza = lote.raza ?? RAZA_DEFAULT
  const dia = m.dias
  const aves = m.avesVivas > 0 ? m.avesVivas : lote.cantidadInicial

  const pesoObjetivoLb = pesoEstandarLb(dia, raza)
  const pesoRealLb = m.pesoPromedioLb
  const desviacionPct =
    pesoRealLb != null && pesoObjetivoLb > 0
      ? ((pesoRealLb - pesoObjetivoLb) / pesoObjetivoLb) * 100
      : undefined

  const alimentoDiaLb = alimentoDiaEstandarLb(dia, raza) * aves

  return {
    dia,
    pesoObjetivoLb,
    pesoRealLb,
    desviacionPct,
    alimentoAcumLb: alimentoAcumEstandarLb(dia, raza) * aves,
    alimentoDiaLb,
    fcaEsperado: alimentoAcumEstandarLb(dia, raza) / Math.max(0.01, pesoEstandarLb(dia, raza)),
    aguaLitrosDia: alimentoDiaLb * 0.82,
    areaM2: aves / AVES_POR_M2,
    tempC: tempRecomendadaC(dia),
    mortalidadEsperadaPct: mortalidadEsperadaPct(dia),
  }
}
