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
      // El galpón es del otro teléfono: aquí no dice nada.
      const { id: _id, galponId: _g, ...datos } = c.lote
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
        db.gastos.bulkAdd(sinId(c.gastos, id)),
        db.ingresos.bulkAdd(sinId(c.ingresos, id)),
        db.pesajes.bulkAdd(sinId(c.pesajes, id)),
        db.aplicaciones.bulkAdd(sinId(c.aplicaciones, id)),
        db.entregas.bulkAdd(sinId(c.entregas, id)),
      ])
      return { id, actualizado: !!previa }
    },
  )
}
