import type {
  Abono,
  Aplicacion,
  Deuda,
  EntregaSocio,
  Gasto,
  Ingreso,
  Lote,
  Pesaje,
  Registro,
} from '../db/schema'
import { diasEntre, hoyISO } from './format'
import type { Settings } from './settings'
import { esObjeto, primerProblema } from './validar'

// Pasada una semana sin respaldo, Inicio lo recuerda: todo vive en el teléfono
// y una semana de registros ya no se reconstruye de memoria.
export const DIAS_PARA_RECORDAR = 7

export const nombreRespaldo = (hoy = hoyISO()) => `avicontrol-respaldo-${hoy}.json`

export function diasSinRespaldo(ultimo: string | null, hoy = hoyISO()): number | null {
  return ultimo ? diasEntre(ultimo, hoy) : null
}

export function tocaRecordarRespaldo(ultimo: string | null, hayDatos: boolean, hoy = hoyISO()) {
  if (!hayDatos) return false
  const dias = diasSinRespaldo(ultimo, hoy)
  return dias == null || dias >= DIAS_PARA_RECORDAR
}

export interface Respaldo {
  version?: number
  settings?: Partial<Settings>
  lotes: Lote[]
  registros: Registro[]
  gastos: Gasto[]
  ingresos: Ingreso[]
  pesajes: Pesaje[]
  aplicaciones: Aplicacion[]
  deudas: Deuda[]
  abonos: Abono[]
  entregas: EntregaSocio[]
}

export type LecturaRespaldo = { ok: true; respaldo: Respaldo } | { ok: false; error: string }

const KG_A_LB = 2.20462

// Los respaldos anteriores a la migración a libras traen alimentoKg y pesoKg.
export function migrarUnidades(data: Pick<Respaldo, 'registros' | 'ingresos'>) {
  for (const r of data.registros) {
    // Lo que no es una fila lo rechaza la revisión que viene después.
    if (!esObjeto(r)) continue
    const viejo = r as Registro & { alimentoKg?: number }
    if (viejo.alimentoKg != null) {
      r.alimentoLb = Math.round(viejo.alimentoKg * KG_A_LB * 10) / 10
      if (r.pesoPromedio != null) r.pesoPromedio = Math.round(r.pesoPromedio * KG_A_LB * 100) / 100
      delete viejo.alimentoKg
    }
    r.alimentoLb ??= 0
  }
  for (const i of data.ingresos) {
    const viejo = i as Ingreso & { pesoKg?: number }
    if (viejo.pesoKg != null) {
      i.pesoLb = Math.round(viejo.pesoKg * KG_A_LB * 10) / 10
      delete viejo.pesoKg
    }
  }
}

/**
 * Revisa un respaldo antes de restaurarlo, que reemplaza todo lo que hay.
 * Antes solo se miraba que trajera las cuatro listas: un archivo cortado o
 * editado a mano entraba con fechas vacías o montos que no eran números, o
 * fallaba a medias con dos filas del mismo número. Ahora, si algo no cuadra,
 * no se toca nada y se dice qué fue.
 */
export function validarRespaldo(data: unknown, versionActual: number): LecturaRespaldo {
  if (!esObjeto(data)) return { ok: false, error: 'El archivo no tiene el formato de un respaldo de AviControl.' }
  const requeridas = ['lotes', 'registros', 'gastos', 'ingresos'] as const
  if (!requeridas.every((k) => Array.isArray(data[k])))
    return { ok: false, error: 'El archivo no tiene el formato de un respaldo de AviControl.' }
  const version = typeof data.version === 'number' ? data.version : 1
  if (version > versionActual)
    return { ok: false, error: 'Ese respaldo es de una versión más nueva de la app. Actualiza AviControl primero.' }

  const lista = (k: string) => (data[k] == null ? [] : data[k])
  const respaldo = {
    version,
    settings: esObjeto(data.settings) ? (data.settings as Partial<Settings>) : undefined,
    lotes: data.lotes,
    registros: data.registros,
    gastos: data.gastos,
    ingresos: data.ingresos,
    pesajes: lista('pesajes'),
    aplicaciones: lista('aplicaciones'),
    deudas: lista('deudas'),
    abonos: lista('abonos'),
    entregas: lista('entregas'),
  }
  const problema = primerProblema([
    ['lotes', respaldo.lotes],
    ['pesajes', respaldo.pesajes],
    ['aplicaciones', respaldo.aplicaciones],
    ['deudas', respaldo.deudas],
    ['abonos', respaldo.abonos],
    ['entregas', respaldo.entregas],
    ['gastos', respaldo.gastos],
    ['ingresos', respaldo.ingresos],
  ])
  if (problema) return { ok: false, error: `El respaldo está dañado: ${problema}. No se cambió nada.` }
  // Los días se revisan después de pasar los kilos de antes a libras.
  migrarUnidades(respaldo as Respaldo)
  const dias = primerProblema([['registros', respaldo.registros]])
  if (dias) return { ok: false, error: `El respaldo está dañado: ${dias}. No se cambió nada.` }
  return { ok: true, respaldo: respaldo as Respaldo }
}
