import {
  AVES_POR_M2,
  PESO_OBJETIVO_DEFAULT,
  PLAN_SANITARIO_DEFAULT,
  RINDE_ARREGLADO_PCT,
  type HitoSanitario,
} from './standards'
import type { TipoBebedero, TipoComedero, TipoEquipo } from './equipo'

const KEY = 'avicontrol.settings'

// Un galpón de la granja con sus medidas, que se guardan en metros. Quien tiene
// dos o tres galpones con ciclos a la vez necesita que cada ciclo sepa en cuál
// está: la densidad y el equipo salen de sus medidas.
export interface Galpon {
  id: string
  nombre: string
  largoM?: number
  anchoM?: number
}

export interface Settings {
  moneda: string
  granja: string
  galpones: Galpon[]
  // Los que se quitaron y tenían ciclos: se guardan para que esos ciclos sigan
  // diciendo dónde estuvieron. Antes pasaban al primer galpón, y Reportes por
  // galpón juntaba ciclos de dos galpones distintos.
  galponesQuitados: Galpon[]
  // Las medidas se guardan en metros; esto es solo cómo se escriben y se leen.
  unidadMedida: 'm' | 'pies'
  // El equipo de la granja: con qué se da agua y comida, y para cuántas aves
  // alcanza cada uno si el modelo no es el de la cifra por defecto.
  bebedero: TipoBebedero
  comedero: TipoComedero
  avesPorEquipo: Partial<Record<TipoEquipo, number>>
  // Defaults de producción (aplican a cada ciclo nuevo).
  pesoObjetivoLb: number
  // El día en que se vende si el ciclo no tiene el suyo. Sin él, cuando las
  // aves llegan al peso de venta.
  diaVenta?: number
  // Lo que paga el pollero o la granja por la libra en pie.
  precioMercadoLb?: number
  // Cómo se vende el pollo. En pie, al pollero, por libra viva; o arreglado
  // —matado y limpio, por libra arreglada, a cada quien a su precio—. Arreglado,
  // `rindePct` es lo que queda de cada 100 lb en pie y `costoArregloAve` lo que
  // cuesta arreglar cada pollo: el gas, las fundas, el hielo.
  venta: 'pie' | 'arreglado'
  rindePct: number
  costoArregloAve: number
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
  galpones: [{ id: 'g1', nombre: 'Galpón 1' }],
  galponesQuitados: [],
  pesoObjetivoLb: PESO_OBJETIVO_DEFAULT,
  venta: 'pie',
  rindePct: RINDE_ARREGLADO_PCT,
  costoArregloAve: 0,
  avesPorM2: AVES_POR_M2,
  unidadAlimento: 'qq',
  planSanitario: PLAN_SANITARIO_DEFAULT,
  ultimoRespaldo: null,
}

// Rellena con defaults sin pisar lo que ya hay: un respaldo v1 no trae los
// campos nuevos y aun así tiene que quedar completo tras importar.
export function getSettings(): Settings {
  try {
    return completar(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return defaults
  }
}

// Lo guardado, completado con los defaults. El plan sanitario vacío es un
// plan: quien no vacuna o no quiere avisos lo deja así. Antes, al quitar la
// última vacuna, volvían las tres de fábrica con sus avisos. Las medidas
// sueltas de antes pasan al «Galpón 1» y no se vuelven a escribir.
function completar(guardado: Record<string, unknown>): Settings {
  const { galponLargoM: _l, galponAnchoM: _a, ...resto } = guardado
  return {
    ...defaults,
    ...(resto as Partial<Settings>),
    planSanitario: Array.isArray(guardado.planSanitario)
      ? (guardado.planSanitario as HitoSanitario[])
      : defaults.planSanitario,
    galpones: leerGalpones(guardado),
    galponesQuitados: Array.isArray(guardado.galponesQuitados)
      ? (guardado.galponesQuitados as Galpon[]).filter(
          (g) => g && typeof g.id === 'string' && typeof g.nombre === 'string',
        )
      : [],
  }
}

// Antes la granja tenía un solo galpón, con sus medidas sueltas en los
// ajustes: pasan a ser el «Galpón 1». Siempre queda al menos uno.
export function leerGalpones(guardado: Record<string, unknown>): Galpon[] {
  const lista = Array.isArray(guardado.galpones)
    ? (guardado.galpones as Galpon[]).filter(
        (g) => g && typeof g.id === 'string' && typeof g.nombre === 'string',
      )
    : []
  if (lista.length) return lista
  const medida = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined)
  return [
    {
      id: 'g1',
      nombre: 'Galpón 1',
      largoM: medida(guardado.galponLargoM),
      anchoM: medida(guardado.galponAnchoM),
    },
  ]
}

// Al restaurar un respaldo, sus ajustes reemplazan a los de este teléfono: antes
// se mezclaban, y el precio de mercado del teléfono viejo sobrevivía a la
// restauración.
export function reemplazarSettings(nuevos: Record<string, unknown>) {
  const next = completar(nuevos)
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('settings-changed'))
  return next
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('settings-changed'))
  return next
}
