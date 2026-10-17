import type { Lote, Registro } from '../db/schema'
import { diasEntre, pct } from './format'
import { LIMITE_PRIMERA_SEMANA_PCT } from './mortalidad'
import { KG_POR_LB, pesoEstandarLb } from './standards'

// La primera semana dice más del pollito y del recibo que del manejo: lo que
// muere ahí, lo que llegó muerto en las cajas y cuánto creció desde que llegó.
// Con eso se le reclama a la incubadora, o se cambia de una a otra.

/** Muertos en las cajas: sobre esto hay que reclamarle a la incubadora. */
export const LIMITE_DOA_PCT = 0.5
/** A los 7 días el pollito debe pesar 4.5 veces lo que pesó al llegar (Cobb). */
export const FACTOR_7_BUENO = 4.5
export const FACTOR_7_MALO = 4

export const G_POR_LB = KG_POR_LB * 1000

export interface Arranque {
  incubadora?: string
  pesoLlegadaG?: number
  muertosLlegada: number
  /** Muertos en las cajas, del total que llegó. */
  doaPct: number
  /** Bajas y descartes de los días 1 al 7. */
  bajas7: number
  pct7: number
  /** El peso más cercano al día 7 (del 6 al 8), en gramos. */
  peso7G?: number
  diaPeso7?: number
  /** Cuántas veces el peso de llegada pesaron al día 7. */
  factor7?: number
  /** Lo que pesa un Cobb al día 7. */
  peso7CobbG: number
  /** Ya pasaron los siete días. */
  completa: boolean
}

export function computeArranque(
  lote: Pick<Lote, 'fechaInicio' | 'cantidadInicial' | 'incubadora' | 'pesoLlegadaG' | 'muertosLlegada'>,
  registros: Registro[],
  diaActual: number,
): Arranque {
  const muertosLlegada = lote.muertosLlegada ?? 0
  let bajas7 = 0
  let peso7: { dia: number; lb: number } | undefined
  for (const r of registros) {
    const dia = diasEntre(lote.fechaInicio, r.fecha)
    // Desde el día que llegaron: lo que muere el día 0 también es del arranque.
    if (dia >= 0 && dia <= 7) bajas7 += (r.mortalidad ?? 0) + (r.descarte ?? 0)
    if (r.pesoPromedio != null && r.pesoPromedio > 0 && dia >= 6 && dia <= 8) {
      if (!peso7 || Math.abs(dia - 7) < Math.abs(peso7.dia - 7)) peso7 = { dia, lb: r.pesoPromedio }
    }
  }
  const colocados = Math.max(0, lote.cantidadInicial - muertosLlegada)
  const peso7G = peso7 ? Math.round(peso7.lb * G_POR_LB) : undefined
  const llegada = lote.pesoLlegadaG && lote.pesoLlegadaG > 0 ? lote.pesoLlegadaG : undefined
  return {
    incubadora: lote.incubadora?.trim() || undefined,
    pesoLlegadaG: llegada,
    muertosLlegada,
    doaPct: lote.cantidadInicial > 0 ? (muertosLlegada / lote.cantidadInicial) * 100 : 0,
    bajas7,
    pct7: colocados > 0 ? (bajas7 / colocados) * 100 : 0,
    peso7G,
    diaPeso7: peso7?.dia,
    factor7: peso7G != null && llegada ? peso7G / llegada : undefined,
    peso7CobbG: Math.round(pesoEstandarLb(7) * G_POR_LB),
    completa: diaActual >= 7,
  }
}

export const arranqueBueno = (a: Arranque) => a.pct7 <= LIMITE_PRIMERA_SEMANA_PCT

export interface PorIncubadora {
  incubadora: string
  ciclos: number
  doaPct: number
  pct7: number
  mortalidadPct: number
  fca?: number
  factor7?: number
}

// Los ciclos cerrados por incubadora: la que manda pollitos que llegan muertos
// o arrancan flojos se ve al ponerlas una junto a otra.
export function porIncubadora(
  ciclos: { arranque: Arranque; mortalidadPct: number; fca?: number }[],
): PorIncubadora[] {
  const grupos = new Map<string, { nombre: string; xs: typeof ciclos }>()
  for (const c of ciclos) {
    const nombre = c.arranque.incubadora
    if (!nombre) continue
    const clave = nombre.toLowerCase()
    const g = grupos.get(clave) ?? { nombre, xs: [] }
    g.xs.push(c)
    grupos.set(clave, g)
  }
  const prom = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null && Number.isFinite(x))
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
  }
  return [...grupos.values()]
    .map(({ nombre, xs }) => ({
      incubadora: nombre,
      ciclos: xs.length,
      doaPct: prom(xs.map((c) => c.arranque.doaPct)) ?? 0,
      pct7: prom(xs.map((c) => c.arranque.pct7)) ?? 0,
      mortalidadPct: prom(xs.map((c) => c.mortalidadPct)) ?? 0,
      fca: prom(xs.map((c) => c.fca)),
      factor7: prom(xs.map((c) => c.arranque.factor7)),
    }))
    .sort((a, b) => b.ciclos - a.ciclos || a.incubadora.localeCompare(b.incubadora))
}

// Del texto de las casillas del recibo a lo que se guarda en el ciclo.
export function reciboParaGuardar(incubadora: string, pesoG: string, muertos: string) {
  const peso = Number(pesoG.replace(',', '.'))
  const doa = Math.round(Number(muertos) || 0)
  return {
    incubadora: incubadora.trim() || undefined,
    pesoLlegadaG: peso > 0 ? Math.round(peso * 10) / 10 : undefined,
    muertosLlegada: doa > 0 ? doa : undefined,
  }
}

export function tituloArranque(a: Arranque, dia: number): string {
  if (!a.completa) return `La primera semana va en el día ${Math.max(0, dia)}`
  return a.pct7 <= LIMITE_PRIMERA_SEMANA_PCT
    ? `Buen arranque: ${pct(a.pct7, 2)} en los primeros siete días`
    : `El arranque se pasó: ${pct(a.pct7, 2)} en los primeros siete días`
}
