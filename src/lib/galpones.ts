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

// Para un ciclo nuevo, el primer galpón que no tiene uno en curso: casi siempre
// es donde van a entrar los pollitos.
export function galponLibre(galpones: Galpon[], activos: Pick<Lote, 'galponId'>[]): Galpon | undefined {
  const ocupados = new Set(activos.map((l) => galponDe(l, { galpones })?.id))
  return galpones.find((g) => !ocupados.has(g.id)) ?? galpones[0]
}

// Con un solo galpón el nombre no dice nada; con varios, dice dónde está el ciclo.
export function nombreGalpon(lote: Pick<Lote, 'galponId'>, s: Pick<Settings, 'galpones'>): string | undefined {
  return s.galpones.length > 1 ? galponDe(lote, s)?.nombre : undefined
}
