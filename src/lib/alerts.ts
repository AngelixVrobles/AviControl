import type { Aplicacion, Gasto, Ingreso, Lote, Registro } from '../db/schema'
import { juicioFca, type LoteMetrics } from './metrics'
import { resumenAgua } from './agua'
import { calorReciente, fraseCalor, gradosCalor } from './calor'
import { retiroEn } from './retiro'
import { computeInventarioAlimento, computePlanAlimento } from './plan'
import { sinAves } from './lote'
import { agendaSanitaria } from './sanidad'
import { getSettings } from './settings'
import { diasEntre, fecha, hoyISO, num, pct, plural, sumarDias } from './format'
import {
  DIAS_RETIRO,
  FASES_ALIMENTO,
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
  sanidad: { plan?: HitoSanitario[]; aplicaciones?: Aplicacion[]; ingresos?: Ingreso[] } = {},
): Alerta[] {
  // Lo de un ciclo compartido lo resuelve quien lo lleva, en su teléfono.
  if (lote.estado !== 'activo' || lote.compartido) return []
  // Sin aves no hay día que registrar ni peso que tomar: el único aviso es el
  // que importa.
  if (sinAves(m))
    return [
      {
        nivel: 'warn',
        texto:
          m.vendidas > 0
            ? 'Vendiste todas las aves y el ciclo sigue abierto: ciérralo para ver cómo salió'
            : 'No quedan aves en el galpón: cierra el ciclo',
      },
    ]
  const alertas: Alerta[] = []

  // Un día anotado con una fecha que todavía no llega es un error al escribir:
  // se avisa para corregirlo, y no cuenta como el último registro, que si no
  // callaba el aviso de días sin registro hasta esa fecha.
  const hoy = hoyISO()
  const futuro = registros.find((r) => r.fecha > hoy)
  if (futuro)
    alertas.push({
      nivel: 'warn',
      texto: `Hay un día anotado con fecha ${fecha(futuro.fecha)}, que todavía no llega: corrígelo en el historial`,
    })

  // Un pesaje no cuenta como registro del día: el último es el último completo.
  const completos = registros.filter((r) => !r.soloPeso && r.fecha <= hoy)
  const ultimo = completos.length ? completos[completos.length - 1] : undefined
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

  const jf = juicioFca(m)
  if (m.fca != null && jf?.estado === 'dudosoBajo') {
    alertas.push({
      nivel: 'warn',
      texto: `La conversión sale en ${num(m.fca, 2)}, imposible al día ${jf.dia} (Cobb ${num(jf.estandar, 2)}): falta alimento por anotar, o cuenta los sacos`,
    })
  } else if (m.fca != null && jf?.estado === 'dudosoAlto') {
    alertas.push({
      nivel: 'warn',
      texto: `La conversión sale en ${num(m.fca, 2)}, más del doble de Cobb (${num(jf.estandar, 2)}): revisa si anotaste libras donde iban sacos`,
    })
  } else if (m.fca != null && jf && jf.dia >= 21 && m.fca > jf.estandar + 0.15) {
    alertas.push({
      nivel: 'warn',
      texto: `FCA ${num(m.fca, 2)}, sobre el estándar Cobb (${num(jf.estandar, 2)} al día ${jf.dia})`,
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
  const agua = resumenAgua(lote, registros, sanidad.ingresos)
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

  // El calor de hoy o de ayer, con lo que hay que hacer: con el pollo grande no
  // espera al día siguiente.
  const calor = calorReciente(lote, registros, hoy)
  if (calor && calor.nivel !== 'bien') {
    const cuando = calor.dia === diasEntre(lote.fechaInicio, hoy) ? 'Hoy' : 'Ayer'
    alertas.push({
      nivel: calor.nivel === 'peligro' ? 'bad' : 'warn',
      texto: `${cuando} el galpón llegó a ${gradosCalor(calor)}. ${fraseCalor(calor).replace(/\.$/, '')}`,
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
    } else if (inv.existenciaQq <= 0) {
      // Por lo anotado y lo estimado de los días sin dato ya no queda: antes,
      // justo cuando se acababa, el aviso desaparecía.
      alertas.push({
        nivel: 'bad',
        texto:
          inv.diasSinAnotar > 0
            ? 'Por lo que se ha dado ya no queda alimento comprado (aprox.): cuenta los sacos o anota la compra'
            : 'Ya no queda alimento comprado: anota la compra que falta o cuenta los sacos',
      })
    } else if (inv.diasQueAlcanza <= 3) {
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

  // El retiro de lo que se dio: si se vende antes de que se cumpla, la carne
  // sale con residuos de la medicina. Con el ciclo ya en su día de venta, la
  // venta es cualquier día desde hoy.
  const enRetiro = retiroEn(sanidad.aplicaciones ?? [], hoy)
  if (enRetiro) {
    const venta = sumarDias(lote.fechaInicio, m.diaObjetivo)
    const fechaVenta = venta > hoy ? venta : hoy
    alertas.push(
      enRetiro.libreDesde > fechaVenta
        ? {
            nivel: 'bad',
            texto: `No vendas antes del ${fecha(enRetiro.libreDesde)}: ${enRetiro.nombre} tiene ${enRetiro.dias} días de retiro${
              fechaVenta === hoy ? ', aunque ya estén en peso' : ` y la venta iba para el ${fecha(fechaVenta)}`
            }`,
          }
        : {
            nivel: 'info',
            texto: `En retiro de ${enRetiro.nombre}: se puede vender desde el ${fecha(enRetiro.libreDesde)}`,
          },
    )
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
