import { borrarBorradoresDe } from '../lib/borrador'
import { db, type Gasto } from './schema'

// Borra el ciclo con todo lo que se anotó en él, en una sola transacción: o se
// va todo o no se va nada. Las deudas y sus abonos se quedan, que son de la
// granja y no del ciclo. Antes no había forma de quitar un ciclo de prueba o uno
// creado dos veces, y se quedaba para siempre en Reportes y en Inicio.
export async function borrarCiclo(loteId: number) {
  await db.transaction(
    'rw',
    [db.lotes, db.registros, db.gastos, db.ingresos, db.pesajes, db.aplicaciones, db.entregas],
    async () => {
      // El alimento que vino de otro ciclo vuelve a ese: su mitad se borra y
      // allá sigue en el almacén. El que este ciclo pasó a otro se queda allá
      // como una compra, sin el traspaso: los sacos están en ese galpón, y
      // borrarlo le bajaba la existencia y los costos al ciclo en curso.
      const conTraspaso = (await db.gastos.where('loteId').equals(loteId).toArray()).filter(
        (g) => g.traspaso?.gastoId != null,
      )
      // La mitad que sale lleva los quintales en negativo; el monto no basta:
      // un alimento sin costo anotado sale con −0, que no es menor que 0.
      const salio = (g: Gasto) => (g.cantidadQq ?? 0) < 0 || g.monto < 0
      const vinieron = conTraspaso.filter((g) => !salio(g)).map((g) => g.traspaso!.gastoId!)
      const pasaron = conTraspaso.filter(salio).map((g) => g.traspaso!.gastoId!)
      if (vinieron.length) await db.gastos.bulkDelete(vinieron)
      for (const id of pasaron) await db.gastos.update(id, { traspaso: undefined })
      await Promise.all([
        db.registros.where('loteId').equals(loteId).delete(),
        db.gastos.where('loteId').equals(loteId).delete(),
        db.ingresos.where('loteId').equals(loteId).delete(),
        db.pesajes.where('loteId').equals(loteId).delete(),
        db.aplicaciones.where('loteId').equals(loteId).delete(),
        db.entregas.where('loteId').equals(loteId).delete(),
      ])
      await db.lotes.delete(loteId)
    },
  )
  borrarBorradoresDe(loteId)
}

// Todo lo anotado: los ciclos con lo suyo y las deudas de la granja con sus
// abonos. Los Ajustes se quedan, que son la granja y no sus datos. Antes se
// quedaban también las vacunas, las deudas y los abonos, y reaparecían sueltos.
export async function borrarTodo() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
  borrarBorradoresDe()
}
