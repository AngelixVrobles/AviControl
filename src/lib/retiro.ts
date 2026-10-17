import type { Aplicacion } from '../db/schema'
import { diasEntre, sumarDias } from './format'

// El retiro de una medicina: los días que hay que esperar después de la última
// dosis para vender, para que la carne no lleve residuos. Lo dice la etiqueta
// del frasco y cambia de una a otra: enrofloxacina, sulfas y tetraciclinas no
// esperan lo mismo, y los cinco días fijos de antes no servían para todas.
export interface Retiro {
  aplicacion: Aplicacion
  nombre: string
  dias: number
  /** El último día que se dio. */
  ultimaDosis: string
  /** Desde este día se puede vender. */
  libreDesde: string
}

export const ultimaDosis = (a: Pick<Aplicacion, 'fecha' | 'diasTratamiento'>) =>
  sumarDias(a.fecha, Math.max(1, Math.round(a.diasTratamiento ?? 1)) - 1)

export function retiroDe(a: Aplicacion): Retiro | undefined {
  const dias = Math.round(a.retiroDias ?? 0)
  if (!(dias > 0)) return undefined
  const ultima = ultimaDosis(a)
  return { aplicacion: a, nombre: a.nombre, dias, ultimaDosis: ultima, libreDesde: sumarDias(ultima, dias) }
}

const masLargo = (rs: (Retiro | undefined)[]) =>
  rs
    .filter((r): r is Retiro => !!r)
    .sort((a, b) => b.libreDesde.localeCompare(a.libreDesde))[0]

// Lo que no deja vender en esa fecha: lo que ya se había dado y todavía no
// cumple el retiro. Con varias, la que termina más tarde.
export function retiroEn(aplicaciones: Aplicacion[], fecha: string): Retiro | undefined {
  return masLargo(
    aplicaciones.map(retiroDe).filter((r) => r && r.aplicacion.fecha <= fecha && fecha < r.libreDesde),
  )
}

/** Días que faltan para poder vender, contados desde `fecha`. */
export const diasDeRetiro = (r: Retiro, fecha: string) => Math.max(0, diasEntre(fecha, r.libreDesde))
