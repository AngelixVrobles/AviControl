import { claveOrigen, type CicloCompartido } from '../lib/compartido'
import { db, type Lote } from './schema'

const sinId = <T extends { id: number }>(filas: T[], loteId: number) =>
  filas.map(({ id: _id, ...resto }) => ({ ...resto, loteId })) as unknown as T[]

/**
 * Guarda el ciclo que mandó un socio como una copia de solo mirar. Si ya
 * estaba, la copia se reemplaza entera con lo nuevo: lo que él corrigió o
 * borró en su teléfono también cambia aquí.
 */
export async function guardarCicloCompartido(c: CicloCompartido): Promise<{ id: number; actualizado: boolean }> {
  const origen = claveOrigen(c.lote)
  return db.transaction(
    'rw',
    [db.lotes, db.registros, db.gastos, db.ingresos, db.pesajes, db.aplicaciones, db.entregas],
    async () => {
      const previa = (await db.lotes.toArray()).find((l) => l.compartido?.origen === origen)
      // Los galpones son del otro teléfono: aquí no dicen nada, ni el del ciclo
      // ni a cuál se pasaron aves o de cuál salió una venta.
      const { id: _id, galponId: _g, movimientos: _m, ...datos } = c.lote
      const lote: Omit<Lote, 'id'> = {
        ...datos,
        compartido: { de: c.de, exportado: c.exportado, origen },
      }
      let id: number
      if (previa) {
        id = previa.id
        await Promise.all(
          [db.registros, db.gastos, db.ingresos, db.pesajes, db.aplicaciones, db.entregas].map((t) =>
            t.where('loteId').equals(id).delete(),
          ),
        )
        await db.lotes.put({ ...lote, id })
      } else {
        id = (await db.lotes.add(lote as Lote)) as number
      }
      await Promise.all([
        db.registros.bulkAdd(sinId(c.registros, id)),
        // Un traspaso de alimento apunta a ciclos del otro teléfono.
        db.gastos.bulkAdd(sinId(c.gastos.map(({ traspaso: _t, ...g }) => g) as typeof c.gastos, id)),
        db.ingresos.bulkAdd(sinId(c.ingresos.map(({ galponId: _gv, ...i }) => i) as typeof c.ingresos, id)),
        db.pesajes.bulkAdd(sinId(c.pesajes, id)),
        db.aplicaciones.bulkAdd(sinId(c.aplicaciones, id)),
        db.entregas.bulkAdd(sinId(c.entregas, id)),
      ])
      return { id, actualizado: !!previa }
    },
  )
}
