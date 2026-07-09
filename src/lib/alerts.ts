import type { Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { diasEntre, hoyISO, num, pct } from './format'
import { EDAD_INICIAL_DEFAULT, posturaEstandarPct } from './standards'

export interface Alerta {
  nivel: 'bad' | 'warn' | 'info'
  texto: string
}

const VACUNAS_ENGORDE: Record<number, string> = {
  7: 'Newcastle + Bronquitis',
  14: 'Gumboro',
  21: 'Refuerzo Newcastle',
}

export function computeAlertas(lote: Lote, registros: Registro[], m: LoteMetrics): Alerta[] {
  if (lote.estado !== 'activo') return []
  const alertas: Alerta[] = []

  const ultimo = registros.length ? registros[registros.length - 1] : undefined
  const diasSinRegistro = ultimo ? diasEntre(ultimo.fecha, hoyISO()) : m.dias
  if (diasSinRegistro >= 2 && m.dias >= 2) {
    alertas.push({
      nivel: 'warn',
      texto: `Sin registro desde hace ${diasSinRegistro} días`,
    })
  }

  if (m.mortalidadPct > 5) {
    alertas.push({ nivel: 'bad', texto: `Mortalidad acumulada alta: ${pct(m.mortalidadPct)}` })
  } else if (ultimo && m.avesVivas > 0) {
    const diaria = (ultimo.mortalidad / (m.avesVivas + ultimo.mortalidad)) * 100
    if (ultimo.mortalidad >= 3 && diaria > 0.5) {
      alertas.push({
        nivel: 'warn',
        texto: `Mortalidad alta en el último registro: ${num(ultimo.mortalidad)} aves`,
      })
    }
  }

  if (lote.tipo === 'engorde') {
    if (m.fca && m.fca > 1.9 && m.dias >= 21) {
      alertas.push({
        nivel: 'warn',
        texto: `FCA ${num(m.fca, 2)}, por encima del estándar (~1.7)`,
      })
    }
    const vacuna = VACUNAS_ENGORDE[m.dias]
    if (vacuna) {
      alertas.push({ nivel: 'info', texto: `Día ${m.dias}: vacuna ${vacuna} (plan típico)` })
    }
  } else {
    const semanaEdad = (lote.edadInicialSemanas ?? EDAD_INICIAL_DEFAULT) + m.dias / 7
    const tieneHuevos = registros.some((r) => (r.huevos ?? 0) > 0)
    if (tieneHuevos && semanaEdad >= 25 && semanaEdad <= 60 && (m.posturaPct ?? 0) > 0) {
      const estandar = posturaEstandarPct(semanaEdad)
      if ((m.posturaPct ?? 0) < estandar - 15) {
        alertas.push({
          nivel: 'warn',
          texto: `Postura ${pct(m.posturaPct!, 0)}, por debajo del estándar (${pct(estandar, 0)})`,
        })
      }
    }
  }

  return alertas
}
