import type { Ingreso, Lote, Registro } from '../db/schema'
import { diasEntre } from './format'

// Un pollo bebe cerca del doble de lo que come en peso: 1 lb de alimento pide
// unos 0.82 L. En el calor dominicano sube, y por eso la banda normal es ancha.
export const LITROS_POR_LB_ALIMENTO = 0.82
const BANDA_BAJA = 0.7
const BANDA_ALTA = 1.4
const CAIDA_ALERTA_PCT = 20

export interface DiaAgua {
  dia: number
  fecha: string
  litros: number
  alimentoLb: number
  esperadoL: number
  /** Cero si ese día no se anotó el alimento: no hay con qué compararlo. */
  litrosPorLb: number
  /** Las aves que había esa mañana, para que una venta no parezca una caída. */
  aves: number
}

export interface ResumenAgua {
  dias: DiaAgua[]
  ultimo: DiaAgua
  promedioLitrosPorLb: number
  estado: 'normal' | 'bajo' | 'alto'
  totalL: number
  caidaPct?: number
}

export const aguaEsperadaL = (alimentoLb: number) => alimentoLb * LITROS_POR_LB_ALIMENTO

export const estadoAgua = (litrosPorLb: number): ResumenAgua['estado'] =>
  litrosPorLb < BANDA_BAJA ? 'bajo' : litrosPorLb > BANDA_ALTA ? 'alto' : 'normal'

export function resumenAgua(lote: Lote, registros: Registro[], ingresos: Ingreso[] = []): ResumenAgua | null {
  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ventas = ingresos.filter((i) => i.tipo === 'aves')
  const colocados = Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0))
  // Las aves de cada mañana: las que entraron, menos las bajas de los días
  // anteriores y lo vendido antes de ese día.
  const avesEn = new Map<string, number>()
  let bajas = 0
  for (const r of ordenados) {
    const vendidas = ventas.filter((i) => i.fecha < r.fecha).reduce((a, i) => a + i.cantidad, 0)
    avesEn.set(r.fecha, Math.max(0, colocados - bajas - vendidas))
    bajas += (r.mortalidad ?? 0) + (r.descarte ?? 0)
  }
  const conAgua = ordenados.filter((r) => Number.isFinite(r.aguaL) && (r.aguaL as number) > 0)
  if (!conAgua.length) return null

  const dias: DiaAgua[] = conAgua.map((r) => {
    const litros = r.aguaL!
    const alimentoLb = r.alimentoLb ?? 0
    return {
      dia: diasEntre(lote.fechaInicio, r.fecha),
      fecha: r.fecha,
      litros,
      alimentoLb,
      esperadoL: aguaEsperadaL(alimentoLb),
      litrosPorLb: alimentoLb > 0 ? litros / alimentoLb : 0,
      aves: avesEn.get(r.fecha) ?? colocados,
    }
  })

  const ultimo = dias[dias.length - 1]
  const totalL = dias.reduce((a, d) => a + d.litros, 0)
  const totalAlimento = dias.reduce((a, d) => a + d.alimentoLb, 0)
  const litrosPorLb = totalAlimento > 0 ? totalL / totalAlimento : 0
  // Se juzga por el último día con el alimento anotado: quien lleva el
  // alimento contando sacos no anota el del día, y sin él cada día salía
  // «bebiendo poco, 0.00 L por libra».
  const ultimoConAlimento = [...dias].reverse().find((d) => d.alimentoLb > 0)

  // El estado se juzga por el último día, no por el promedio del ciclo: un
  // promedio sano esconde que hoy dejaron de beber.
  return {
    dias,
    ultimo,
    promedioLitrosPorLb: litrosPorLb,
    estado: ultimoConAlimento ? estadoAgua(ultimoConAlimento.litrosPorLb) : 'normal',
    totalL,
    caidaPct: caidaDeAgua(dias),
  }
}

// Lo que de verdad avisa: el consumo del último día contra el promedio de los
// tres anteriores. Si cae de golpe, algo pasó ayer aunque las aves se vean bien.
// Se compara por ave: vender la mitad del lote no es que dejaron de beber.
export function caidaDeAgua(dias: DiaAgua[]): number | undefined {
  if (dias.length < 3) return undefined
  const porAve = (d: DiaAgua) => (d.aves > 0 ? d.litros / d.aves : d.litros)
  const ultimo = dias[dias.length - 1]
  const previos = dias.slice(-4, -1)
  if (previos.length < 2) return undefined
  const promedio = previos.reduce((a, d) => a + porAve(d), 0) / previos.length
  if (promedio <= 0) return undefined
  const caida = ((promedio - porAve(ultimo)) / promedio) * 100
  return caida >= CAIDA_ALERTA_PCT ? caida : undefined
}
