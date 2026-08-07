import { AVES_POR_M2, PESO_OBJETIVO_DEFAULT, PLAN_SANITARIO_DEFAULT, type HitoSanitario } from './standards'

const KEY = 'avicontrol.settings'

export interface Settings {
  moneda: string
  granja: string
  galponLargoM?: number
  galponAnchoM?: number
  // Defaults de producción (aplican a cada ciclo nuevo).
  pesoObjetivoLb: number
  precioMercadoLb?: number
  avesPorM2: number
  planSanitario: HitoSanitario[]
  ultimoRespaldo: string | null
}

const defaults: Settings = {
  moneda: 'RD$',
  granja: 'Mi granja',
  pesoObjetivoLb: PESO_OBJETIVO_DEFAULT,
  avesPorM2: AVES_POR_M2,
  planSanitario: PLAN_SANITARIO_DEFAULT,
  ultimoRespaldo: null,
}

// Rellena con defaults sin pisar lo que ya hay: un respaldo v1 no trae los
// campos nuevos y aun así tiene que quedar completo tras importar.
export function getSettings(): Settings {
  try {
    const guardado = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      ...defaults,
      ...guardado,
      planSanitario:
        Array.isArray(guardado.planSanitario) && guardado.planSanitario.length
          ? guardado.planSanitario
          : defaults.planSanitario,
    }
  } catch {
    return defaults
  }
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('settings-changed'))
  return next
}
