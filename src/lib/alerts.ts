import type { Gasto, Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { computeInventarioAlimento, computePlanAlimento } from './plan'
import { diasEntre, hoyISO, num, pct } from './format'
import { DIAS_RETIRO, FASES_ALIMENTO, fcaEstandar, mortalidadEsperadaPct } from './standards'

export interface Alerta {
  nivel: 'bad' | 'warn' | 'info'
  texto: string
}

const VACUNAS_ENGORDE: Record<number, string> = {
  7: 'Newcastle + Bronquitis',
  14: 'Gumboro',
  21: 'Refuerzo Newcastle',
}

export function computeAlertas(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
): Alerta[] {
  if (lote.estado !== 'activo') return []
  const alertas: Alerta[] = []

  const ultimo = registros.length ? registros[registros.length - 1] : undefined
  const diasSinRegistro = ultimo ? diasEntre(ultimo.fecha, hoyISO()) : m.dias
  if (diasSinRegistro >= 2 && m.dias >= 2) {
    alertas.push({ nivel: 'warn', texto: `Sin registro desde hace ${diasSinRegistro} días` })
  }

  if (m.mortalidadPct > mortalidadEsperadaPct(m.dias) + 2) {
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

  if (m.fca && m.dias >= 21 && m.fca > fcaEstandar(m.dias) + 0.15) {
    alertas.push({
      nivel: 'warn',
      texto: `FCA ${num(m.fca, 2)}, sobre el estándar Cobb (${num(fcaEstandar(m.dias), 2)})`,
    })
  }

  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  const ultimoPesaje = conPeso.length ? conPeso[conPeso.length - 1] : undefined
  const diasSinPesar = ultimoPesaje ? diasEntre(ultimoPesaje.fecha, hoyISO()) : m.dias
  if (m.dias >= 7 && diasSinPesar >= 7) {
    alertas.push({
      nivel: 'warn',
      texto: ultimoPesaje
        ? `Hace ${diasSinPesar} días que no pesas: sin peso no hay proyección`
        : 'Aún no has pesado ninguna ave de este lote',
    })
  }

  const inv = computeInventarioAlimento(gastos, m, computePlanAlimento(lote, m)?.totalQuintales ?? 0)
  if (inv?.completo) {
    if (inv.existenciaQq < -1) {
      alertas.push({
        nivel: 'warn',
        texto: `Diste ${num(inv.consumidoQq, 1)} qq y solo hay ${num(inv.compradoQq, 1)} comprados: falta anotar una compra`,
      })
    } else if (inv.existenciaQq > 0 && inv.diasQueAlcanza <= 3) {
      alertas.push({
        nivel: 'bad',
        texto:
          inv.diasQueAlcanza === 0
            ? `Te quedan ${num(inv.existenciaQq, 1)} qq: no alcanzan para mañana`
            : `Te queda alimento para ${inv.diasQueAlcanza} ${inv.diasQueAlcanza === 1 ? 'día' : 'días'}`,
      })
    }
  }

  const cambio = FASES_ALIMENTO.find((f) => f.desde === m.dias && f.desde > 0)
  if (cambio) {
    alertas.push({ nivel: 'info', texto: `Día ${m.dias}: cambia a alimento ${cambio.nombre}` })
  }

  const vacuna = VACUNAS_ENGORDE[m.dias]
  if (vacuna) {
    alertas.push({ nivel: 'info', texto: `Día ${m.dias}: vacuna ${vacuna} (plan típico)` })
  }

  const paraVenta = m.diaObjetivo - m.dias
  if (paraVenta === DIAS_RETIRO) {
    alertas.push({
      nivel: 'info',
      texto: `Faltan ${DIAS_RETIRO} días para la venta: retira el alimento medicado`,
    })
  }

  return alertas
}
