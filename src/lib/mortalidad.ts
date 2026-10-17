import type { CausaBaja, Ingreso, Lote, Registro } from '../db/schema'
import { diasEntre } from './format'
import { mortalidadEsperadaPct } from './standards'

export interface DiaMortalidad {
  dia: number
  fecha: string
  muertes: number
  descartes: number
  acumuladas: number
  pctAcum: number
  pctEsperado: number
  vivas: number
}

export interface SemanaMortalidad {
  semana: number
  muertes: number
  pctDelLote: number
  esperadoPct: number
}

export interface ResumenMortalidad {
  dias: DiaMortalidad[]
  semanas: SemanaMortalidad[]
  bajas: number
  descartes: number
  /** Muertas sobre las aves que entraron: la misma mortalidad de la tarjeta. */
  pct: number
  pctDescarte: number
  esperadoPct: number
  primeraSemana: number
  primeraSemanaPct: number
  peorDia?: DiaMortalidad
  vivas: number
}

// La mortalidad de la primera semana se mira aparte: viene de la incubadora y
// del arranque, no del manejo del resto del ciclo. Sobre 1 % ya es señal.
export const LIMITE_PRIMERA_SEMANA_PCT = 1

// Las cuentas van sobre las aves que entraron al galpón —sin las que llegaron
// muertas en las cajas—, como en el resto de la app. Las que quedan restan
// también lo vendido hasta ese día: antes decía «quedan 950» con 600 vendidas.
export function resumenMortalidad(
  lote: Lote,
  registros: Registro[],
  ingresos: Ingreso[] = [],
): ResumenMortalidad | null {
  if (!registros.length) return null

  const inicial = Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0))
  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ventas = ingresos.filter((i) => i.tipo === 'aves')
  const vendidasHasta = (f: string) => ventas.filter((i) => i.fecha <= f).reduce((a, i) => a + i.cantidad, 0)

  let acumuladas = 0
  let muertasAcum = 0
  const dias: DiaMortalidad[] = ordenados.map((r) => {
    const muertes = r.mortalidad ?? 0
    const descartes = r.descarte ?? 0
    acumuladas += muertes + descartes
    muertasAcum += muertes
    const dia = diasEntre(lote.fechaInicio, r.fecha)
    return {
      dia,
      fecha: r.fecha,
      muertes,
      descartes,
      acumuladas,
      pctAcum: inicial > 0 ? (muertasAcum / inicial) * 100 : 0,
      pctEsperado: mortalidadEsperadaPct(dia),
      vivas: Math.max(0, inicial - acumuladas - vendidasHasta(r.fecha)),
    }
  })

  const semanas = new Map<number, SemanaMortalidad>()
  for (const d of dias) {
    const n = Math.floor(Math.max(0, d.dia - 1) / 7) + 1
    const s = semanas.get(n) ?? { semana: n, muertes: 0, pctDelLote: 0, esperadoPct: 0 }
    s.muertes += d.muertes + d.descartes
    semanas.set(n, s)
  }
  for (const s of semanas.values()) {
    s.pctDelLote = inicial > 0 ? (s.muertes / inicial) * 100 : 0
    const hasta = mortalidadEsperadaPct(s.semana * 7)
    const desde = mortalidadEsperadaPct((s.semana - 1) * 7)
    s.esperadoPct = Math.max(0, hasta - desde)
  }

  // Desde el día que llegaron: lo que muere el día 0 también es del arranque.
  const primeraSemana = dias.filter((d) => d.dia <= 7).reduce((a, d) => a + d.muertes + d.descartes, 0)
  const conBajas = dias.filter((d) => d.muertes + d.descartes > 0)
  const ultimo = dias[dias.length - 1]

  return {
    dias,
    semanas: [...semanas.values()].sort((a, b) => a.semana - b.semana),
    bajas: dias.reduce((a, d) => a + d.muertes, 0),
    descartes: dias.reduce((a, d) => a + d.descartes, 0),
    pct: ultimo.pctAcum,
    pctDescarte: inicial > 0 ? (dias.reduce((a, d) => a + d.descartes, 0) / inicial) * 100 : 0,
    esperadoPct: mortalidadEsperadaPct(ultimo.dia),
    primeraSemana,
    primeraSemanaPct: inicial > 0 ? (primeraSemana / inicial) * 100 : 0,
    peorDia: conBajas.length
      ? conBajas.reduce((peor, d) => (d.muertes + d.descartes > peor.muertes + peor.descartes ? d : peor))
      : undefined,
    vivas: ultimo.vivas,
  }
}

export interface CausaDelCiclo {
  causa: CausaBaja
  muertes: number
  /** De las muertes con causa anotada. */
  pct: number
}

// De qué se murió el lote, con lo anotado día por día. Las muertes de los días
// sin causa se cuentan aparte: si son la mayoría, el resto dice poco.
export function causasDelCiclo(registros: Pick<Registro, 'mortalidad' | 'causa'>[]): {
  causas: CausaDelCiclo[]
  sinCausa: number
} | null {
  const por = new Map<CausaBaja, number>()
  let sinCausa = 0
  for (const r of registros) {
    const n = r.mortalidad ?? 0
    if (n <= 0) continue
    if (r.causa) por.set(r.causa, (por.get(r.causa) ?? 0) + n)
    else sinCausa += n
  }
  const conCausa = [...por.values()].reduce((a, n) => a + n, 0)
  if (!conCausa) return null
  const causas = [...por.entries()]
    .map(([causa, muertes]) => ({ causa, muertes, pct: (muertes / conCausa) * 100 }))
    .sort((a, b) => b.muertes - a.muertes)
  return { causas, sinCausa }
}
