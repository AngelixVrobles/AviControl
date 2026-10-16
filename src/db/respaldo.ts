import type { Settings } from '../lib/settings'
import { db } from './schema'

export const VERSION_RESPALDO = 4

// Todo lo que hay en el teléfono, en el formato que Ajustes sabe restaurar.
export async function leerRespaldo(settings: Settings): Promise<string> {
  const [lotes, registros, gastos, ingresos, pesajes, aplicaciones, deudas, abonos, entregas] =
    await Promise.all([
      db.lotes.toArray(),
      db.registros.toArray(),
      db.gastos.toArray(),
      db.ingresos.toArray(),
      db.pesajes.toArray(),
      db.aplicaciones.toArray(),
      db.deudas.toArray(),
      db.abonos.toArray(),
      db.entregas.toArray(),
    ])
  return JSON.stringify(
    {
      version: VERSION_RESPALDO,
      settings,
      lotes,
      registros,
      gastos,
      ingresos,
      pesajes,
      aplicaciones,
      deudas,
      abonos,
      entregas,
    },
    null,
    2,
  )
}
