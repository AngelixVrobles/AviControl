import type { Ingreso, Lote } from '../db/schema'
import { diasEntre, hoyISO } from './format'

// Lo que ya entró de una venta. A crédito, la suma de los cobros; si no, la
// venta completa el día que se hizo.
export function cobradoDe(i: Pick<Ingreso, 'monto' | 'credito' | 'cobros'>): number {
  if (!i.credito) return i.monto
  return (i.cobros ?? []).reduce((a, c) => a + (c.monto > 0 ? c.monto : 0), 0)
}

export const pendienteDe = (i: Pick<Ingreso, 'monto' | 'credito' | 'cobros'>): number =>
  Math.max(0, i.monto - cobradoDe(i))

export const nombreComprador = (i: Pick<Ingreso, 'comprador'>) =>
  i.comprador?.trim() || 'Sin nombre'

export interface VentaPorCobrar {
  ingreso: Ingreso
  lote?: Lote
  pendiente: number
  /** Días desde la venta. */
  dias: number
}

export interface CompradorQueDebe {
  comprador: string
  total: number
  ventas: VentaPorCobrar[]
  /** Días de la venta más vieja que todavía debe. */
  masVieja: number
}

export interface PorCobrar {
  total: number
  ventas: number
  compradores: CompradorQueDebe[]
}

// Lo que te deben, por comprador: el que más debe primero, y dentro de cada
// uno la venta más vieja primero, que es la que hay que ir a cobrar.
export function cuentasPorCobrar(ingresos: Ingreso[], lotes: Lote[], hoy = hoyISO()): PorCobrar {
  const porLote = new Map(lotes.map((l) => [l.id, l]))
  const grupos = new Map<string, VentaPorCobrar[]>()
  for (const i of ingresos) {
    const pendiente = pendienteDe(i)
    if (!i.credito || pendiente < 1) continue
    const venta = {
      ingreso: i,
      lote: i.loteId != null ? porLote.get(i.loteId) : undefined,
      pendiente,
      dias: diasEntre(i.fecha, hoy),
    }
    const clave = nombreComprador(i)
    const lista = grupos.get(clave)
    if (lista) lista.push(venta)
    else grupos.set(clave, [venta])
  }
  const compradores = [...grupos].map(([comprador, ventas]) => {
    ventas.sort((a, b) => a.ingreso.fecha.localeCompare(b.ingreso.fecha))
    return {
      comprador,
      total: ventas.reduce((a, v) => a + v.pendiente, 0),
      ventas,
      masVieja: Math.max(...ventas.map((v) => v.dias)),
    }
  })
  compradores.sort((a, b) => b.total - a.total)
  return {
    total: compradores.reduce((a, c) => a + c.total, 0),
    ventas: compradores.reduce((a, c) => a + c.ventas.length, 0),
    compradores,
  }
}

// Los compradores de antes, el más reciente primero, para no tener que
// escribir el nombre cada vez.
export function compradoresConocidos(ingresos: Ingreso[]): string[] {
  const vistos = new Map<string, string>()
  for (const i of ingresos) {
    const nombre = i.comprador?.trim()
    if (!nombre) continue
    const clave = nombre.toLowerCase()
    const previo = vistos.get(clave)
    if (!previo || i.fecha > previo.split('|')[0]) vistos.set(clave, `${i.fecha}|${nombre}`)
  }
  return [...vistos.values()].sort((a, b) => b.localeCompare(a)).map((v) => v.split('|')[1])
}
