import { aguaEsperadaL } from './agua'
import { num, plural } from './format'
import type { Settings } from './settings'
import { KG_POR_LB, KG_POR_M2, alimentoDiaEstandarLb } from './standards'

export type TipoBebedero = 'plasson' | 'niple'
export type TipoComedero = 'tolva' | 'plato'
export type TipoEquipo = TipoBebedero | TipoComedero

interface ReglaEquipo {
  nombre: string
  corto: string
  aves: number
  // Lo que alcanza al empezar, cuando el pollito come poco y cabe más por plato.
  avesInicio?: number
  nota: string
}

// Cifras por defecto, que el productor puede cambiar si su modelo es otro.
// Bebedero Plasson de campana: el fabricante pide 8–10 por cada 1.000 aves en
// clima templado (100–125 cada uno); en galpón abierto con calor se baja a 80.
// Comedero de tolva Plasson de 15–20 kg: 80 pollitos al empezar y 45 aves al
// final. Plato de línea automática de 33 cm: 50–70 aves (Cobb). Niple: 10 aves,
// 12 si es de alto flujo (Cobb).
export const EQUIPOS: Record<TipoEquipo, ReglaEquipo> = {
  plasson: {
    nombre: 'Bebederos Plasson',
    corto: 'Plasson',
    aves: 80,
    nota: 'con calor; en clima fresco aguantan de 100 a 125',
  },
  niple: {
    nombre: 'Niples',
    corto: 'niples',
    aves: 10,
    nota: '12 si son de alto flujo',
  },
  tolva: {
    nombre: 'Comederos de tolva',
    corto: 'tolvas',
    aves: 45,
    avesInicio: 80,
    nota: 'tolva de 15–20 kg',
  },
  plato: {
    nombre: 'Platos de comedero',
    corto: 'platos',
    aves: 60,
    nota: 'plato de 33 cm en línea automática',
  },
}

// Para el recibo, además del equipo de todo el ciclo (Cobb): bandeja o papel
// con alimento por cada 50 pollitos los primeros 7–10 días, un bebedero de galón
// por cada 100 los primeros días, y la criadora según su capacidad, que en las
// de gas de campana suele ser de 1.000 pollitos.
const POLLITOS_POR_BANDEJA = 50
const POLLITOS_POR_GALON = 100
const POLLITOS_POR_CRIADORA = 1000
// En el recibo los pollitos van juntos cerca de la criadora: 40–50 por m².
const POLLITOS_POR_M2_RECIBO = 45

const SEPARACION_NIPLE_M = 0.35
const DISTANCIA_MAX_M = 3
const PIES_POR_M = 3.28084
const LITROS_POR_GALON = 3.78541

export const enPies = (metros: number) => metros * PIES_POR_M
export const enPies2 = (m2: number) => m2 * PIES_POR_M ** 2
export const deMedida = (valor: number, unidad: 'm' | 'pies') =>
  unidad === 'pies' ? valor / PIES_POR_M : valor
export const aMedida = (metros: number, unidad: 'm' | 'pies') =>
  unidad === 'pies' ? metros * PIES_POR_M : metros
export const enGalones = (litros: number) => litros / LITROS_POR_GALON

export interface ConfigEquipo {
  bebedero: TipoBebedero
  comedero: TipoComedero
  avesPor?: Partial<Record<TipoEquipo, number>>
}

export const avesPorUnidad = (tipo: TipoEquipo, config: ConfigEquipo) => {
  const propio = config.avesPor?.[tipo]
  return propio && propio > 0 ? propio : EQUIPOS[tipo].aves
}

export interface ItemEquipo {
  tipo?: TipoEquipo
  nombre: string
  cantidad: number
  avesPorUnidad: number
  alInicio?: number
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
  comederos: ItemEquipo
  bebederos: ItemEquipo
  crianza: ItemEquipo[]
  metrosDeNiples: number
  aguaFinalL: number
  galpon?: {
    areaM2: number
    avesMaximas: number
    limitePorPeso: boolean
    avesPorM2Hoy: number
    kgM2AlVender: number
    sobrepoblado: boolean
    reciboM2: number
    reciboLargoM: number
    comederos: Distribucion
    bebederos: Distribucion
    lleno: { comederos: number; bebederos: number }
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

const cuantos = (aves: number, porUnidad: number) => Math.ceil(aves / Math.max(1, porUnidad))

export function computeEquipo({
  aves,
  pesoObjetivoLb,
  diaVenta,
  config,
  avesPorM2,
  largoM,
  anchoM,
}: {
  aves: number
  pesoObjetivoLb: number
  diaVenta: number
  config: ConfigEquipo
  avesPorM2: number
  largoM?: number
  anchoM?: number
}): PlanEquipo | null {
  if (aves <= 0) return null

  const rBeb = EQUIPOS[config.bebedero]
  const rCom = EQUIPOS[config.comedero]
  const porBebedero = avesPorUnidad(config.bebedero, config)
  const porComedero = avesPorUnidad(config.comedero, config)
  const bebederos = cuantos(aves, porBebedero)
  const comederos = cuantos(aves, porComedero)
  // Al empezar caben más pollitos por tolva, pero nunca menos tolvas de las que
  // pide la cifra del productor si la bajó por debajo de la de inicio.
  const alInicio =
    rCom.avesInicio && rCom.avesInicio > porComedero ? cuantos(aves, rCom.avesInicio) : undefined

  const plan: PlanEquipo = {
    aves,
    bebederos: {
      tipo: config.bebedero,
      nombre: rBeb.nombre,
      cantidad: bebederos,
      avesPorUnidad: porBebedero,
      regla: rBeb.nota,
    },
    comederos: {
      tipo: config.comedero,
      nombre: rCom.nombre,
      cantidad: comederos,
      avesPorUnidad: porComedero,
      alInicio,
      regla: rCom.nota,
    },
    crianza: [
      {
        nombre: 'Bandejas de recibo',
        cantidad: cuantos(aves, POLLITOS_POR_BANDEJA),
        avesPorUnidad: POLLITOS_POR_BANDEJA,
        regla: `1 por cada ${POLLITOS_POR_BANDEJA} pollitos, hasta el día 7–10`,
      },
      {
        nombre: 'Bebederos de galón',
        cantidad: cuantos(aves, POLLITOS_POR_GALON),
        avesPorUnidad: POLLITOS_POR_GALON,
        regla: `1 por cada ${POLLITOS_POR_GALON} pollitos, además de los ${rBeb.corto}, los primeros 5–7 días`,
      },
      {
        nombre: 'Criadoras',
        cantidad: cuantos(aves, POLLITOS_POR_CRIADORA),
        avesPorUnidad: POLLITOS_POR_CRIADORA,
        regla: '1 por cada 1.000 pollitos; revisa la capacidad de tu modelo',
      },
    ],
    metrosDeNiples: config.bebedero === 'niple' ? bebederos * SEPARACION_NIPLE_M : 0,
    aguaFinalL: aguaEsperadaL(alimentoDiaEstandarLb(diaVenta) * aves),
  }

  if (largoM && anchoM && largoM > 0 && anchoM > 0) {
    const areaM2 = largoM * anchoM
    const pesoKg = Math.max(0.1, pesoObjetivoLb * KG_POR_LB)
    // Lo que manda es lo más estricto entre la densidad de la granja (aves por
    // m²) y los 30 kg/m² al peso de venta: a 6.5 lb, 11 aves por m² ya son 32 kg.
    const porDensidad = Math.floor(areaM2 * avesPorM2)
    const porPeso = Math.floor((areaM2 * KG_POR_M2) / pesoKg)
    const avesMaximas = Math.min(porDensidad, porPeso)
    const reciboM2 = aves / POLLITOS_POR_M2_RECIBO

    plan.galpon = {
      areaM2,
      avesMaximas,
      limitePorPeso: porPeso < porDensidad,
      avesPorM2Hoy: aves / areaM2,
      kgM2AlVender: (aves * pesoKg) / areaM2,
      sobrepoblado: aves > avesMaximas,
      reciboM2,
      reciboLargoM: Math.min(largoM, reciboM2 / anchoM),
      comederos: distribuir(comederos, largoM, anchoM),
      bebederos: distribuir(bebederos, largoM, anchoM),
      lleno: {
        comederos: cuantos(avesMaximas, porComedero),
        bebederos: cuantos(avesMaximas, porBebedero),
      },
    }
  }

  return plan
}

// El plan con el equipo y las medidas que el productor guardó en la granja.
export function equipoDeLaGranja(aves: number, pesoObjetivoLb: number, diaVenta: number, s: Settings) {
  return computeEquipo({
    aves,
    pesoObjetivoLb,
    diaVenta,
    config: { bebedero: s.bebedero, comedero: s.comedero, avesPor: s.avesPorEquipo },
    avesPorM2: s.avesPorM2,
    largoM: s.galponLargoM,
    anchoM: s.galponAnchoM,
  })
}

export function resumenEquipo(plan: PlanEquipo): string {
  const [bandejas, galones, criadoras] = plan.crianza
  return [
    `${num(plan.bebederos.cantidad)} ${EQUIPOS[plan.bebederos.tipo!].corto}`,
    `${num(plan.comederos.cantidad)} ${EQUIPOS[plan.comederos.tipo!].corto}`,
    `${num(bandejas.cantidad)} bandejas`,
    `${num(galones.cantidad)} bebederos de galón`,
    `${num(criadoras.cantidad)} ${plural(criadoras.cantidad, 'criadora', 'criadoras')}`,
  ].join(' · ')
}
