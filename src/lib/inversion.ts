import type { CategoriaGasto, Gasto, Lote } from '../db/schema'
import { diasEntre, hoyISO, sumarDias } from './format'

// Lo invertido en un ciclo hasta cierta edad: los pollitos, que entran el día 0,
// y cada gasto con fecha hasta ese día —también lo comprado antes de recibir—.
// Es dinero puesto, no consumido: el alimento comprado por adelantado cuenta el
// día que se pagó. Así se compara un ciclo contra otro a la misma edad.

export interface ParteInversion {
  categoria: CategoriaGasto
  monto: number
}

export interface InversionAlDia {
  /** El día que se pidió. */
  dia: number
  /** El día que de verdad se mide: el pedido, o el último del ciclo si no llegó. */
  hastaDia: number
  fecha: string
  /** El ciclo llegó a esa edad (o ya cerró después de ella). */
  llego: boolean
  /** Hoy si sigue activo; el día de cierre si ya cerró. */
  diaFinal: number
  total: number
  porAve: number
  partes: ParteInversion[]
}

export function diaDelCiclo(lote: Lote, hoy = hoyISO()): number {
  return diasEntre(lote.fechaInicio, lote.fechaCierre ?? hoy)
}

export function invertidoAlDia(
  lote: Lote,
  gastos: Gasto[],
  dia: number,
  hoy = hoyISO(),
): InversionAlDia {
  const diaFinal = diaDelCiclo(lote, hoy)
  const hastaDia = Math.max(0, Math.min(dia, diaFinal))
  const fecha = sumarDias(lote.fechaInicio, hastaDia)
  // Un ciclo cerrado ya no suma por edad: desde el día de cierre cuenta todo lo
  // que se gastó en él, también lo que se pagó después de vender.
  const todo = lote.estado === 'cerrado' && dia >= diaFinal
  const incluidos = todo ? gastos : gastos.filter((g) => g.fecha <= fecha)

  const porCategoria = new Map<CategoriaGasto, number>()
  if (lote.costoInicial > 0) porCategoria.set('aves', lote.costoInicial)
  for (const g of incluidos) {
    if (!(g.monto > 0)) continue
    porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto)
  }
  const partes = [...porCategoria.entries()]
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)
  const total = partes.reduce((a, p) => a + p.monto, 0)

  return {
    dia,
    hastaDia,
    fecha,
    llego: dia <= diaFinal,
    diaFinal,
    total,
    porAve: lote.cantidadInicial > 0 ? total / lote.cantidadInicial : 0,
    partes,
  }
}

// Lo invertido por pollito día por día, del 0 al último día del ciclo (o al
// tope que se pida). Por pollito y no en total: un ciclo de 1.000 aves y otro de
// 2.000 solo se pueden comparar así.
export function curvaInversion(
  lote: Lote,
  gastos: Gasto[],
  hasta: number,
  hoy = hoyISO(),
): (number | undefined)[] {
  const diaFinal = diaDelCiclo(lote, hoy)
  const aves = Math.max(1, lote.cantidadInicial)
  const ordenados = gastos
    .filter((g) => g.monto > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const out: (number | undefined)[] = []
  let acumulado = Math.max(0, lote.costoInicial)
  let i = 0
  for (let d = 0; d <= hasta; d++) {
    if (d > diaFinal) {
      out.push(undefined)
      continue
    }
    const fecha = sumarDias(lote.fechaInicio, d)
    while (i < ordenados.length && ordenados[i].fecha <= fecha) acumulado += ordenados[i++].monto
    // El último día de un ciclo cerrado lleva todo, igual que invertidoAlDia.
    if (d === diaFinal && lote.estado === 'cerrado')
      while (i < ordenados.length) acumulado += ordenados[i++].monto
    out.push(acumulado / aves)
  }
  return out
}

export interface CicloComparado {
  lote: Lote
  inversion: InversionAlDia
  /** Diferencia por pollito contra el ciclo que se está viendo, en %. */
  difPct?: number
  anterior: boolean
}

// Los otros ciclos a la misma edad, del más reciente al más viejo. «Anterior»
// es el último que empezó antes que este: el que el productor tiene en la cabeza.
export function compararConOtros(
  lote: Lote,
  propio: InversionAlDia,
  otros: { lote: Lote; gastos: Gasto[] }[],
  dia: number,
  hoy = hoyISO(),
): CicloComparado[] {
  const candidatos = otros
    .filter((o) => o.lote.id !== lote.id)
    .sort((a, b) => b.lote.fechaInicio.localeCompare(a.lote.fechaInicio))
  const anterior = candidatos.find((o) => o.lote.fechaInicio <= lote.fechaInicio)

  return candidatos.map((o) => {
    const inversion = invertidoAlDia(o.lote, o.gastos, dia, hoy)
    return {
      lote: o.lote,
      inversion,
      // Solo se comparan dos ciclos que llegaron a esa edad: lo del día 14
      // contra lo del día 30 dice más del calendario que de la crianza.
      difPct:
        propio.llego && inversion.llego && inversion.porAve > 0 && propio.porAve > 0
          ? ((propio.porAve - inversion.porAve) / inversion.porAve) * 100
          : undefined,
      anterior: o === anterior,
    }
  })
}
