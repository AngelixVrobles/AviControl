import type { ConteoAlimento, Gasto, Lote, Registro } from '../db/schema'
import { diasEntre, sumarDias } from './format'
import { comprasAlimento } from './precios'
import { LB_POR_QUINTAL, alimentoDiaEstandarLb } from './standards'

export interface DiaAlimento {
  dia: number
  fecha: string
  lb: number
  // Lo que el productor escribió ese día; el resto de `lb` sale del conteo.
  anotadoLb: number
}

export interface Descuadre {
  fecha: string
  qq: number
}

export interface ConsumoAlimento {
  dias: DiaAlimento[]
  totalLb: number
  anotadoLb: number
  porConteoLb: number
  // Último día del que se sabe cuánto se dio: el FCA se mide a ese día, no a
  // hoy, porque los días sin dato no tienen alimento pero sí peso.
  hastaDia?: number
  conteos: (ConteoAlimento & { dia: number })[]
  // Hay conteos pero alguna compra no tiene quintales: sin eso no se puede
  // saber cuánto entró y el conteo no dice nada.
  conteosSinUsar: boolean
  descuadres: Descuadre[]
}

// Medio saco de diferencia es error de conteo, no una compra perdida.
const TOLERANCIA_LB = 50

// El alimento dado sale de dos fuentes. La primera, lo anotado día por día. La
// segunda, el conteo de sacos: lo comprado hasta esa fecha menos lo que queda
// es lo que se dio, y lo que no se anotó en ese tramo se reparte entre los días
// sin dato según la curva de consumo Cobb. El conteo puede sumar lo que no se
// anotó, pero nunca borra lo anotado: si no cuadra, lo más probable es una
// compra sin anotar y eso se avisa.
export function consumoAlimento(lote: Lote, registros: Registro[], gastos: Gasto[]): ConsumoAlimento {
  const diaDe = (fecha: string) => diasEntre(lote.fechaInicio, fecha)

  const anotado = new Map<number, number>()
  for (const r of registros) {
    const lb = r.alimentoLb
    if (!(lb > 0) || !Number.isFinite(lb)) continue
    const d = diaDe(r.fecha)
    anotado.set(d, (anotado.get(d) ?? 0) + lb)
  }
  const extra = new Map<number, number>()

  const compras = comprasAlimento(gastos)
  const comprasCompletas = compras.length > 0 && compras.every((g) => (g.cantidadQq ?? 0) > 0)

  const limite = lote.fechaCierre ?? '9999-12-31'
  const porFecha = new Map<string, number>()
  for (const c of lote.conteosAlimento ?? []) {
    if (!Number.isFinite(c.qq) || c.qq < 0) continue
    if (c.fecha < lote.fechaInicio || c.fecha > limite) continue
    porFecha.set(c.fecha, c.qq)
  }
  const validos = [...porFecha]
    .map(([fecha, qq]) => ({ fecha, qq, dia: diaDe(fecha) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const conteos = comprasCompletas ? validos : []
  const descuadres: Descuadre[] = []
  let acumulado = 0
  let desde = 0

  for (const c of conteos) {
    const compradoLb =
      compras.filter((g) => g.fecha <= c.fecha).reduce((a, g) => a + g.cantidadQq!, 0) * LB_POR_QUINTAL
    const objetivo = compradoLb - c.qq * LB_POR_QUINTAL - acumulado

    const ventana: number[] = []
    for (let d = desde; d <= c.dia; d++) ventana.push(d)
    const anotadoVentana = ventana.reduce((a, d) => a + (anotado.get(d) ?? 0), 0)

    if (anotadoVentana - objetivo > Math.max(TOLERANCIA_LB, anotadoVentana * 0.03))
      descuadres.push({ fecha: c.fecha, qq: (anotadoVentana - objetivo) / LB_POR_QUINTAL })

    const resto = objetivo - anotadoVentana
    if (resto > 0 && ventana.length) repartir(resto, ventana, anotado, extra)

    acumulado += Math.max(anotadoVentana, objetivo)
    desde = c.dia + 1
  }

  const dias: DiaAlimento[] = [...new Set([...anotado.keys(), ...extra.keys()])]
    .sort((a, b) => a - b)
    .map((dia) => {
      const anotadoLb = anotado.get(dia) ?? 0
      return {
        dia,
        fecha: sumarDias(lote.fechaInicio, dia),
        lb: anotadoLb + (extra.get(dia) ?? 0),
        anotadoLb,
      }
    })
    .filter((d) => d.lb > 0)

  const totalLb = dias.reduce((a, d) => a + d.lb, 0)
  const anotadoLb = dias.reduce((a, d) => a + d.anotadoLb, 0)
  const ultimoAnotado = dias.length ? Math.max(...dias.filter((d) => d.anotadoLb > 0).map((d) => d.dia), -1) : -1
  const ultimoConteo = conteos.length ? conteos[conteos.length - 1].dia : -1
  const hasta = Math.max(ultimoAnotado, ultimoConteo)

  return {
    dias,
    totalLb,
    anotadoLb,
    porConteoLb: totalLb - anotadoLb,
    hastaDia: hasta >= 0 ? hasta : undefined,
    conteos,
    conteosSinUsar: validos.length > 0 && !comprasCompletas,
    descuadres,
  }
}

// Reparte lo que dice el conteo entre los días del tramo que no tienen nada
// anotado, con el peso de la curva de consumo: el día 12 se come el triple que
// el día 3. Si todos los días tienen dato, la diferencia es alimento que se fue
// sin anotar (desperdicio, sacos regalados) y se suma en proporción a lo anotado.
function repartir(
  lb: number,
  ventana: number[],
  anotado: Map<number, number>,
  extra: Map<number, number>,
) {
  const libres = ventana.filter((d) => !((anotado.get(d) ?? 0) > 0))
  const base = libres.length ? libres : ventana
  const pesoDe = (d: number) =>
    libres.length ? alimentoDiaEstandarLb(d) : (anotado.get(d) ?? 0)
  const total = base.reduce((a, d) => a + pesoDe(d), 0)
  for (const d of base) {
    const parte = total > 0 ? (lb * pesoDe(d)) / total : lb / base.length
    if (parte > 0) extra.set(d, (extra.get(d) ?? 0) + parte)
  }
}
