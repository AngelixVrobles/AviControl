import type { Aplicacion, Gasto, Lote, Registro } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { resumenAgua } from './agua'
import { computeInventarioAlimento, computePlanAlimento } from './plan'
import { agendaSanitaria } from './sanidad'
import { getSettings } from './settings'
import { diasEntre, hoyISO, num, pct, plural } from './format'
import {
  DIAS_RETIRO,
  FASES_ALIMENTO,
  fcaEstandar,
  mortalidadEsperadaPct,
  type HitoSanitario,
} from './standards'

export interface Alerta {
  nivel: 'bad' | 'warn' | 'info'
  texto: string
}

// Lo del plan que se pasó sin anotarse se recuerda unos días y no para siempre:
// quien no lleva las vacunas en la app no tiene por qué cargar el aviso todo el
// ciclo, y en la ficha Sanidad sigue apareciendo como atrasado.
const DIAS_AVISO_ATRASO = 3

export function computeAlertas(
  lote: Lote,
  registros: Registro[],
  gastos: Gasto[],
  m: LoteMetrics,
  sanidad: { plan?: HitoSanitario[]; aplicaciones?: Aplicacion[] } = {},
): Alerta[] {
  if (lote.estado !== 'activo') return []
  const alertas: Alerta[] = []

  const ultimo = registros.length ? registros[registros.length - 1] : undefined
  const diasSinRegistro = ultimo ? diasEntre(ultimo.fecha, hoyISO()) : m.dias
  if (diasSinRegistro >= 2 && m.dias >= 2) {
    alertas.push({ nivel: 'warn', texto: `Sin registro desde hace ${diasSinRegistro} ${plural(diasSinRegistro, 'día', 'días')}` })
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
        ? `Hace ${diasSinPesar} ${plural(diasSinPesar, 'día', 'días')} que no pesas: sin peso no hay proyección`
        : 'Aún no has pesado ninguna ave de este lote',
    })
  }

  // El agua avisa antes que nada: una caída de golpe precede al síntoma en un
  // día entero, así que va con la prioridad más alta.
  const agua = resumenAgua(lote, registros)
  if (agua?.caidaPct != null) {
    alertas.push({
      nivel: 'bad',
      texto: `El agua bajó ${pct(agua.caidaPct, 0)} de golpe: revisa bebederos y aves hoy mismo`,
    })
  } else if (agua && agua.estado === 'bajo' && agua.dias.length >= 3) {
    alertas.push({
      nivel: 'warn',
      texto: `Están bebiendo poco para lo que comen (${num(agua.ultimo.litrosPorLb, 2)} L por libra)`,
    })
  }

  // Sin alimento no hay conversión: el productor que anota la mortalidad cada día
  // pero no el alimento veía «FCA 0.00» y no sabía por qué.
  const diasSinAlimento = m.dias - 1 - (m.diaAlimento ?? 0)
  if (m.alimentoTotalLb === 0 && m.dias >= 3) {
    alertas.push({
      nivel: 'warn',
      texto: 'Sin alimento anotado no hay conversión: cuenta los sacos que quedan o anota el del día',
    })
  } else if (m.alimentoTotalLb > 0 && diasSinAlimento >= 4) {
    alertas.push({
      nivel: 'warn',
      texto: `Hace ${diasSinAlimento} ${plural(diasSinAlimento, 'día', 'días')} que no anotas alimento: la conversión se quedó en el día ${m.diaAlimento}`,
    })
  }

  const inv = computeInventarioAlimento(gastos, m, computePlanAlimento(lote, m)?.totalQuintales ?? 0)
  if (inv?.completo) {
    // Lo anotado contra lo comprado, sin la estimación de los días sin dato:
    // una estimación no puede acusar una compra perdida.
    if (inv.compradoQq - inv.consumidoQq < -1) {
      alertas.push({
        nivel: 'warn',
        texto: `Diste ${num(inv.consumidoQq, 1)} qq y solo hay ${num(inv.compradoQq, 1)} comprados: falta anotar una compra`,
      })
    } else if (inv.existenciaQq > 0 && inv.diasQueAlcanza <= 3) {
      const aprox = inv.diasSinAnotar > 0 ? ' (aprox., cuenta los sacos)' : ''
      alertas.push({
        nivel: 'bad',
        texto:
          inv.diasQueAlcanza === 0
            ? `Te quedan ${num(inv.existenciaQq, 1)} qq: no alcanzan para mañana${aprox}`
            : `Te queda alimento para ${inv.diasQueAlcanza} ${inv.diasQueAlcanza === 1 ? 'día' : 'días'}${aprox}`,
      })
    }
  }

  const cambio = FASES_ALIMENTO.find((f) => f.desde === m.dias && f.desde > 0)
  if (cambio) {
    alertas.push({ nivel: 'info', texto: `Día ${m.dias}: cambia a alimento ${cambio.nombre}` })
  }

  // Las vacunas salen del plan de Ajustes y de lo ya anotado: antes era un plan
  // fijo de los días 7, 14 y 21 que avisaba aunque ya se hubiera puesto.
  const plan = sanidad.plan ?? getSettings().planSanitario
  for (const e of agendaSanitaria(lote, m.dias, plan, sanidad.aplicaciones ?? [])) {
    if (e.diaPlan == null || e.estado === 'aplicado' || e.estado === 'extra') continue
    const atraso = m.dias - e.diaPlan
    if (atraso === 0)
      alertas.push({ nivel: 'info', texto: `Hoy toca ${e.nombre} (día ${e.diaPlan} de tu plan)` })
    else if (atraso === -1)
      alertas.push({ nivel: 'info', texto: `Mañana toca ${e.nombre}` })
    else if (atraso > 0 && atraso <= DIAS_AVISO_ATRASO)
      alertas.push({
        nivel: 'warn',
        texto: `${e.nombre} tocaba el día ${e.diaPlan} y no se ha anotado: si ya se puso, márcalo en Sanidad`,
      })
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
