import type { Lote } from '../db/schema'
import type { Galpon, Settings } from './settings'

// El galpón de un ciclo: el suyo, o el primero de la granja si no tiene o si
// ese galpón ya no existe.
export function galponDe(
  lote: Pick<Lote, 'galponId'> | undefined,
  s: Pick<Settings, 'galpones'>,
): Galpon | undefined {
  return s.galpones.find((g) => g.id === lote?.galponId) ?? s.galpones[0]
}

// El nombre sigue la cuenta («Galpón 3») sin repetir uno que ya está. El id no
// se repite nunca, ni con el de un galpón que se quitó: los ciclos que estaban
// en ese galpón no aparecen de pronto en el nuevo.
export function nuevoGalpon(galpones: Galpon[], ahora = Date.now()): Galpon {
  const nombres = new Set(galpones.map((g) => g.nombre.trim().toLowerCase()))
  let n = galpones.length + 1
  while (nombres.has(`galpón ${n}`)) n++
  let id = `g${ahora.toString(36)}`
  while (galpones.some((g) => g.id === id)) id += 'x'
  return { id, nombre: `Galpón ${n}` }
}

type LoteEnGalpones = Pick<Lote, 'galponId'> & Partial<Pick<Lote, 'movimientos' | 'cantidadInicial' | 'muertosLlegada'>>

/** Dónde llegaron los pollitos: el galpón del ciclo, o el primero de la granja. */
export const galponInicial = (lote: Pick<Lote, 'galponId'>, s: Pick<Settings, 'galpones'>) =>
  galponDe(lote, s)?.id ?? lote.galponId ?? 'g1'

/**
 * Los galpones donde está la pollada según lo que se movió, sin contar bajas
 * ni ventas: para nombrarlos y saber cuáles están ocupados sin leer los días.
 */
export function galponesOcupados(lote: LoteEnGalpones, s: Pick<Settings, 'galpones'>): string[] {
  const inicial = galponInicial(lote, s)
  if (!lote.movimientos?.length) return [inicial]
  const aves = new Map<string, number>([[inicial, Math.max(1, (lote.cantidadInicial ?? 1) - (lote.muertosLlegada ?? 0))]])
  for (const m of [...lote.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const n = Math.max(0, Math.min(m.aves, aves.get(m.de) ?? 0))
    aves.set(m.de, (aves.get(m.de) ?? 0) - n)
    aves.set(m.a, (aves.get(m.a) ?? 0) + n)
  }
  return [...aves.entries()].filter(([, v]) => v > 0).map(([g]) => g)
}

export const nombreDeGalpon = (id: string, s: Pick<Settings, 'galpones'>) =>
  s.galpones.find((g) => g.id === id)?.nombre ?? 'un galpón que se quitó'

/** «Galpón 1 y Galpón 2», o «3 galpones». */
export function nombresGalpones(ids: string[], s: Pick<Settings, 'galpones'>): string {
  if (ids.length > 2) return `${ids.length} galpones`
  return ids.map((id) => nombreDeGalpon(id, s)).join(' y ')
}

// Para un ciclo nuevo, el primer galpón que no tiene uno en curso —ni parte de
// una pollada repartida—: casi siempre es donde van a entrar los pollitos.
export function galponLibre(galpones: Galpon[], activos: LoteEnGalpones[]): Galpon | undefined {
  const ocupados = new Set(activos.flatMap((l) => galponesOcupados(l, { galpones })))
  return galpones.find((g) => !ocupados.has(g.id)) ?? galpones[0]
}

// Con un solo galpón el nombre no dice nada; con varios, dice dónde está el
// ciclo, o los galpones entre los que está repartido.
export function nombreGalpon(lote: LoteEnGalpones, s: Pick<Settings, 'galpones'>): string | undefined {
  return s.galpones.length > 1 ? nombresGalpones(galponesOcupados(lote, s), s) : undefined
}
