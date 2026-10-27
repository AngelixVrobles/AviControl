import type { FaseId } from '../lib/standards'
import { db, type Gasto, type Lote } from './schema'

/**
 * Pasa alimento que sobró de un ciclo a otro, con su costo. El que lo compró
 * deja de cargar con sacos que no se comió, y el otro los tiene en su
 * existencia como una compra más. Antes el que cerraba cargaba con ellos y el
 * siguiente los recibía gratis y fuera de su existencia. Son dos gastos que se
 * apuntan uno al otro: en negativo en el que lo pasa, igual en el que lo recibe.
 */
export async function pasarAlimento({
  desde,
  hacia,
  qq,
  monto,
  fecha,
  seLoQueda,
  loPone,
  fase,
}: {
  desde: Pick<Lote, 'id' | 'nombre'>
  hacia: Pick<Lote, 'id' | 'nombre'>
  qq: number
  monto: number
  fecha: string
  /**
   * Con socios distintos en cada ciclo: el socio del ciclo que lo pasa que se
   * queda con el alimento, y el del que lo recibe que lo pone. Sin ellos, lo
   * de todos según su parte, como cuando los socios son los mismos.
   */
  seLoQueda?: number
  loPone?: number
  /** El alimento que sobró: casi siempre engorde, que el otro ciclo da al final. */
  fase?: FaseId
}) {
  await db.transaction('rw', db.gastos, async () => {
    const creado = Date.now()
    const llega = (await db.gastos.add({
      loteId: hacia.id,
      categoria: 'alimento',
      monto,
      cantidadQq: qq,
      fecha,
      descripcion: `Lo que sobró de ${desde.nombre}`,
      traspaso: { loteId: desde.id },
      fase,
      pagadoPor: loPone,
      creado,
    })) as number
    const sale = (await db.gastos.add({
      loteId: desde.id,
      categoria: 'alimento',
      monto: -monto,
      cantidadQq: -qq,
      fecha,
      descripcion: `Pasado a ${hacia.nombre}`,
      traspaso: { loteId: hacia.id, gastoId: llega },
      fase,
      // En negativo: lo que ese socio puso le vuelve en sacos.
      pagadoPor: seLoQueda,
      creado,
    })) as number
    await db.gastos.update(llega, { traspaso: { loteId: desde.id, gastoId: sale } })
  })
}

/** Deshace el traspaso: se van los dos gastos, el de cada ciclo. */
export async function deshacerTraspaso(g: Pick<Gasto, 'id' | 'traspaso'>) {
  await db.transaction('rw', db.gastos, async () => {
    await db.gastos.delete(g.id)
    if (g.traspaso?.gastoId) await db.gastos.delete(g.traspaso.gastoId)
  })
}
