import { diasEntre, fecha as fechaCorta, num } from '../../lib/format'
import type { Retiro } from '../../lib/retiro'

// Vender dentro del retiro de una medicina deja residuos en la carne. No se
// bloquea —puede que el frasco diga otra cosa—, pero se dice antes de guardar.
export function AvisoRetiro({ retiro, fecha }: { retiro?: Retiro; fecha: string }) {
  if (!retiro) return null
  const faltan = diasEntre(fecha, retiro.libreDesde)
  return (
    <div className="rounded-xl border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
      <div className="font-semibold">Todavía en retiro de {retiro.nombre}</div>
      Se puede vender desde el {fechaCorta(retiro.libreDesde)}: {faltan === 1 ? 'falta 1 día' : `faltan ${num(faltan)} días`}.
      Vender antes deja residuos de la medicina en la carne.
    </div>
  )
}
