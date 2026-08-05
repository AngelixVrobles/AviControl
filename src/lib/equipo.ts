import { KG_POR_LB, KG_POR_M2 } from './standards'

// Cifras de la Guía de Manejo del Pollo de Engorde de Cobb: comedero de platón
// de 33 cm por cada 60–70 aves, bandeja por cada 50 pollitos, 14–16 bebederos
// por cada 1.000 pollitos en crianza, 10 aves por niple de bajo flujo (12 en
// alto flujo) y ninguna ave caminando más de 3 m para beber.
const AVES_POR_COMEDERO = 65
const AVES_POR_CAMPANA = 100
const AVES_POR_NIPLE = 10
const POLLITOS_POR_BANDEJA = 50
const POLLITOS_POR_BEBEDERO_CRIANZA = 65
const CM_COMEDERO_POR_AVE = 2.5
const SEPARACION_NIPLE_M = 0.35
const DISTANCIA_MAX_M = 3

const PIES_POR_M = 3.28084

export const enPies = (metros: number) => metros * PIES_POR_M
export const enPies2 = (m2: number) => m2 * PIES_POR_M ** 2

export interface ItemEquipo {
  nombre: string
  cantidad: number
  regla: string
}

export interface Distribucion {
  lineas: number
  separacionM: number
  desdeParedM: number
  porLinea: number
  cadaM: number
  caminataMaxM: number
}

export interface PlanEquipo {
  aves: number
  crianza: ItemEquipo[]
  ciclo: ItemEquipo[]
  metrosDeComedero: number
  metrosDeNiples: number
  galpon?: {
    areaM2: number
    avesMaximas: number
    densidadKgM2: number
    sobrepoblado: boolean
    comederos: Distribucion
    bebederos: Distribucion
  }
}

// Cobb reparte el galpón en líneas según el ancho (2 hasta 12,8 m; 3 hasta 15 m;
// después una más cada 5 m). Con una sola línea el ave del rincón caminaría de
// más, así que en galpones angostos se usa el criterio de los 3 m.
function lineasPorAncho(anchoM: number): number {
  if (anchoM <= 2 * DISTANCIA_MAX_M) return 1
  if (anchoM <= 12.8) return 2
  return Math.max(3, Math.ceil(anchoM / 5))
}

function distribuir(total: number, largoM: number, anchoM: number): Distribucion {
  const lineas = lineasPorAncho(anchoM)
  const porLinea = Math.max(1, Math.ceil(total / lineas))
  const separacionM = anchoM / lineas
  return {
    lineas,
    separacionM,
    desdeParedM: separacionM / 2,
    porLinea,
    cadaM: largoM / porLinea,
    caminataMaxM: separacionM / 2,
  }
}

export function computeEquipo(
  aves: number,
  pesoObjetivoLb: number,
  largoM?: number,
  anchoM?: number,
): PlanEquipo | null {
  if (aves <= 0) return null

  const comederos = Math.ceil(aves / AVES_POR_COMEDERO)
  const campanas = Math.ceil(aves / AVES_POR_CAMPANA)
  const niples = Math.ceil(aves / AVES_POR_NIPLE)

  const plan: PlanEquipo = {
    aves,
    crianza: [
      {
        nombre: 'Bandejas de recibo',
        cantidad: Math.ceil(aves / POLLITOS_POR_BANDEJA),
        regla: `1 por cada ${POLLITOS_POR_BANDEJA} pollitos`,
      },
      {
        nombre: 'Bebederos de galón',
        cantidad: Math.ceil(aves / POLLITOS_POR_BEBEDERO_CRIANZA),
        regla: `15 por cada 1.000 pollitos`,
      },
    ],
    ciclo: [
      {
        nombre: 'Comederos de tolva',
        cantidad: comederos,
        regla: `1 platón de 33 cm por cada 60–70 aves`,
      },
      {
        nombre: 'Bebederos de campana',
        cantidad: campanas,
        regla: `1 por cada ${AVES_POR_CAMPANA} aves`,
      },
      {
        nombre: 'O niples',
        cantidad: niples,
        regla: `1 por cada ${AVES_POR_NIPLE} aves (12 si son de alto flujo)`,
      },
    ],
    metrosDeComedero: (aves * CM_COMEDERO_POR_AVE) / 100,
    metrosDeNiples: niples * SEPARACION_NIPLE_M,
  }

  if (largoM && anchoM && largoM > 0 && anchoM > 0) {
    const areaM2 = largoM * anchoM
    const pesoKg = pesoObjetivoLb * KG_POR_LB
    plan.galpon = {
      areaM2,
      avesMaximas: Math.floor((areaM2 * KG_POR_M2) / Math.max(0.1, pesoKg)),
      densidadKgM2: (aves * pesoKg) / areaM2,
      sobrepoblado: (aves * pesoKg) / areaM2 > KG_POR_M2,
      comederos: distribuir(comederos, largoM, anchoM),
      bebederos: distribuir(campanas, largoM, anchoM),
    }
  }

  return plan
}
