import type { Lote, Registro } from '../db/schema'
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
  litrosPorLb: number
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

export function resumenAgua(lote: Lote, registros: Registro[]): ResumenAgua | null {
  const conAgua = registros
    .filter((r) => Number.isFinite(r.aguaL) && (r.aguaL as number) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
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
    }
  })

  const ultimo = dias[dias.length - 1]
  const totalL = dias.reduce((a, d) => a + d.litros, 0)
  const totalAlimento = dias.reduce((a, d) => a + d.alimentoLb, 0)
  const litrosPorLb = totalAlimento > 0 ? totalL / totalAlimento : 0

  // El estado se juzga por el último día, no por el promedio del ciclo: un
  // promedio sano esconde que hoy dejaron de beber.
  return {
    dias,
    ultimo,
    promedioLitrosPorLb: litrosPorLb,
    estado: estadoAgua(ultimo.litrosPorLb),
    totalL,
    caidaPct: caidaDeAgua(dias),
  }
}

// Lo que de verdad avisa: el consumo del último día contra el promedio de los
// tres anteriores. Si cae de golpe, algo pasó ayer aunque las aves se vean bien.
export function caidaDeAgua(dias: DiaAgua[]): number | undefined {
  if (dias.length < 3) return undefined
  const ultimo = dias[dias.length - 1]
  const previos = dias.slice(-4, -1)
  if (previos.length < 2) return undefined
  const promedio = previos.reduce((a, d) => a + d.litros, 0) / previos.length
  if (promedio <= 0) return undefined
  const caida = ((promedio - ultimo.litros) / promedio) * 100
  return caida >= CAIDA_ALERTA_PCT ? caida : undefined
}
