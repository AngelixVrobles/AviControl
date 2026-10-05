import { AVES_POR_M2, PESO_OBJETIVO_DEFAULT, PLAN_SANITARIO_DEFAULT, type HitoSanitario } from './standards'
import type { TipoBebedero, TipoComedero, TipoEquipo } from './equipo'

const KEY = 'avicontrol.settings'

export interface Settings {
  moneda: string
  granja: string
  galponLargoM?: number
  galponAnchoM?: number
  // Las medidas se guardan en metros; esto es solo cómo se escriben y se leen.
  unidadMedida: 'm' | 'pies'
  // El equipo de la granja: con qué se da agua y comida, y para cuántas aves
  // alcanza cada uno si el modelo no es el de la cifra por defecto.
  bebedero: TipoBebedero
  comedero: TipoComedero
  avesPorEquipo: Partial<Record<TipoEquipo, number>>
  // Defaults de producción (aplican a cada ciclo nuevo).
  pesoObjetivoLb: number
  precioMercadoLb?: number
  avesPorM2: number
  // Cómo se anota el alimento del día: en sacos de 100 lb o en libras.
  unidadAlimento: 'qq' | 'lb'
  planSanitario: HitoSanitario[]
  ultimoRespaldo: string | null
}

const defaults: Settings = {
  moneda: 'RD$',
  granja: 'Mi granja',
  unidadMedida: 'm',
  bebedero: 'plasson',
  comedero: 'tolva',
  avesPorEquipo: {},
  pesoObjetivoLb: PESO_OBJETIVO_DEFAULT,
  avesPorM2: AVES_POR_M2,
  unidadAlimento: 'qq',
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
