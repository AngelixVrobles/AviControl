import { avesQueSalieron, cuadrarAves, type Cuadre } from '../lib/cuadre'
import { db, type Lote } from './schema'

// Al cerrar el ciclo, las aves de las ventas estimadas se cuadran con los
// pollos que salieron. Va dentro de la transacción del cierre, con la última
// venta ya anotada: así el cierre y el cuadre quedan juntos o no queda ninguno.
export async function cuadrarVentas(lote: Lote, bajas: number): Promise<Cuadre | undefined> {
  const ventas = (await db.ingresos.where('loteId').equals(lote.id).toArray()).filter((i) => i.tipo === 'aves')
  const c = cuadrarAves(lote, ventas, avesQueSalieron(lote, bajas))
  if (!c) return undefined
  await Promise.all(
    ventas.map((v, k) => (c.cantidades[k] !== v.cantidad ? db.ingresos.update(v.id, { cantidad: c.cantidades[k] }) : null)),
  )
  return c
}
