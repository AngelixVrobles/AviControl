import type { Lote, Registro } from '../db/schema'
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
  pct: number
  esperadoPct: number
  primeraSemana: number
  primeraSemanaPct: number
  peorDia?: DiaMortalidad
  vivas: number
}

// La mortalidad de la primera semana se mira aparte: viene de la incubadora y
// del arranque, no del manejo del resto del ciclo. Sobre 1 % ya es señal.
export const LIMITE_PRIMERA_SEMANA_PCT = 1

export function resumenMortalidad(lote: Lote, registros: Registro[]): ResumenMortalidad | null {
  if (!registros.length) return null

  const inicial = lote.cantidadInicial
  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))

  let acumuladas = 0
  const dias: DiaMortalidad[] = ordenados.map((r) => {
    const muertes = r.mortalidad ?? 0
    const descartes = r.descarte ?? 0
    acumuladas += muertes + descartes
    const dia = diasEntre(lote.fechaInicio, r.fecha)
    return {
      dia,
      fecha: r.fecha,
      muertes,
      descartes,
      acumuladas,
      pctAcum: inicial > 0 ? (acumuladas / inicial) * 100 : 0,
      pctEsperado: mortalidadEsperadaPct(dia),
      vivas: Math.max(0, inicial - acumuladas),
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

  const primeraSemana = dias.filter((d) => d.dia <= 7).reduce((a, d) => a + d.muertes + d.descartes, 0)
  const conBajas = dias.filter((d) => d.muertes + d.descartes > 0)
  const ultimo = dias[dias.length - 1]

  return {
    dias,
    semanas: [...semanas.values()].sort((a, b) => a.semana - b.semana),
    bajas: dias.reduce((a, d) => a + d.muertes, 0),
    descartes: dias.reduce((a, d) => a + d.descartes, 0),
    pct: ultimo.pctAcum,
    esperadoPct: mortalidadEsperadaPct(ultimo.dia),
    primeraSemana,
    primeraSemanaPct: inicial > 0 ? (primeraSemana / inicial) * 100 : 0,
    peorDia: conBajas.length
      ? conBajas.reduce((peor, d) => (d.muertes + d.descartes > peor.muertes + peor.descartes ? d : peor))
      : undefined,
    vivas: ultimo.vivas,
  }
}
