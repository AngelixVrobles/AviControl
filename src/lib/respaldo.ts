import { diasEntre, hoyISO } from './format'

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
