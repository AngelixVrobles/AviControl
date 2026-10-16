import { borrarBorradoresDe } from '../lib/borrador'
import { db } from './schema'

// Borra el ciclo con todo lo que se anotó en él, en una sola transacción: o se
// va todo o no se va nada. Las deudas y sus abonos se quedan, que son de la
// granja y no del ciclo. Antes no había forma de quitar un ciclo de prueba o uno
// creado dos veces, y se quedaba para siempre en Reportes y en Inicio.
export async function borrarCiclo(loteId: number) {
  await db.transaction(
    'rw',
    [db.lotes, db.registros, db.gastos, db.ingresos, db.pesajes, db.aplicaciones, db.entregas],
    async () => {
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
