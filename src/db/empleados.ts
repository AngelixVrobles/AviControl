import { db, type Lote } from './schema'

// Lo que faltaba pagarles a los empleados se anota como gasto de mano de obra
// al cerrar el ciclo, dentro de la transacción del cierre: la ganancia que
// queda es la de verdad. Antes la estimada lo contaba y la del cierre no.
export async function anotarPagoEmpleados(lote: Pick<Lote, 'id'>, monto: number, fecha: string) {
  if (!(monto >= 1)) return
  await db.gastos.add({
    loteId: lote.id,
    categoria: 'mano_obra',
    monto: Math.round(monto),
    fecha,
    descripcion: 'Pago de empleados',
    creado: Date.now(),
  })
}
