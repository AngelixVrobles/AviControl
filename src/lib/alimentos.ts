import type { Gasto, Lote, Registro } from '../db/schema'
import { eficienciaAlimento, type LoteMetrics } from './metrics'
import { diasEntre } from './format'
import { comprasAlimento, precioQuintalReal } from './precios'
import { getSettings } from './settings'
import { FASES_ALIMENTO, LB_POR_QUINTAL, alimentoDiaEstandarLb, type FaseId } from './standards'

// El alimento que de verdad se da, por tipo. Antes la fase salía de los días
// del estándar —iniciador del 11 al 24, crecimiento del 25 al 35— aunque el
// productor pasara a crecimiento el día 19, y lo que falta por comprar se
// pagaba al precio promedio de todo lo comprado: el pre-inicio a RD$1,985 el
// quintal subía el engorde, que cuesta RD$1,401. Ahora manda lo que se compró:
// cada compra dice su tipo, los sacos se dan en orden —se acaba uno y sigue el
// próximo— y lo que falta se paga a lo que cuesta ese tipo.

export const FASES: FaseId[] = FASES_ALIMENTO.map((f) => f.id)

export const ordenFase = (f: FaseId) => FASES.indexOf(f)

export const nombreFase = (f: FaseId) => FASES_ALIMENTO.find((x) => x.id === f)?.nombre ?? f

/** El que va después en el orden de los alimentos. */
const mayor = (a: FaseId, b?: FaseId): FaseId => (b && ordenFase(b) > ordenFase(a) ? b : a)

/** El alimento que el estándar da ese día de edad. */
export function fasePlan(dia: number): FaseId {
  return (FASES_ALIMENTO.find((f) => dia >= f.desde && dia <= f.hasta) ?? FASES_ALIMENTO[FASES_ALIMENTO.length - 1]).id
}

/**
 * El tipo de alimento por su nombre, como lo escribe el productor: «MEGA
 * BROILER INICIADOR», «PREINICIO POLLO», «19 QUINTALES DE ENGORDE». Sin una
 * palabra conocida no se adivina.
 */
export function faseDeNombre(texto?: string): FaseId | undefined {
  if (!texto) return undefined
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
  if (/\bpre ?(inic|starter)/.test(t)) return 'preinicio'
  if (/inici|starter|arranque/.test(t)) return 'iniciador'
  if (/crec|desarroll|grower/.test(t)) return 'crecimiento'
  if (/engord|final|finisher|termina|acaba/.test(t)) return 'engorde'
  return undefined
}

/** El tipo de una compra: el que se le puso, o el que dice su nombre. */
export const faseDeCompra = (g: Pick<Gasto, 'fase' | 'descripcion'>): FaseId | undefined =>
  g.fase ?? faseDeNombre(g.descripcion)

/** Una compra de alimento con lo que le queda en el almacén. */
export interface Partida {
  gastoId: number
  fase: FaseId
  /** No tiene tipo ni lo dice el nombre: se supuso por el día en que se compró. */
  supuesta: boolean
  nombre?: string
  fecha: string
  qq: number
  quedaLb: number
  precioQq?: number
}

export interface DiaDeAlimento {
  dia: number
  fase: FaseId
  lb: number
  /** Salió de la curva: ese día no tiene alimento anotado ni contado. */
  estimado: boolean
  /** El productor dijo qué alimento dio. */
  elegido: boolean
}

export interface ResumenFase {
  fase: FaseId
  /** Cómo se llama en la granja: el nombre de la última compra de ese tipo. */
  nombre: string
  compradoQq: number
  dadoLb: number
  quedaLb: number
  /** Los días en que de verdad se dio. */
  desdeDia?: number
  hastaDia?: number
  /** A cuánto sale el quintal de lo que falta por comprar de este tipo. */
  precioQq?: number
}

export interface AlimentoPorTipo {
  dias: DiaDeAlimento[]
  fases: ResumenFase[]
  partidas: Partida[]
  /** El que se está dando hoy. */
  actual: FaseId
  /** El que sigue cuando se acabe el de hoy. */
  siguiente?: FaseId
  /** Los días que alcanza lo que queda del alimento de hoy, con lo que comen. */
  alcanzaActual: number
  /** Compras sin tipo que el nombre no dice: se supuso por la fecha. */
  supuestas: number
  /** Lo que se dio sin una compra que lo respalde: falta anotar una. */
  sinCompraLb: number
}

const consumir = (p: Partida, lb: number) => {
  const toma = Math.min(p.quedaLb, lb)
  p.quedaLb -= toma
  return lb - toma
}

/**
 * Reparte lo que se ha dado entre las compras, día por día: se da del alimento
 * que se eligió ese día o, si no, del primero que tenga sacos —en el orden
 * pre-inicio, iniciador, crecimiento, engorde, y dentro de cada uno el que se
 * compró primero—. Nunca se vuelve atrás: si ayer se dio engorde, hoy no toca
 * iniciador aunque sobren sacos.
 */
export function alimentoPorTipo(lote: Lote, registros: Registro[], gastos: Gasto[], m: LoteMetrics): AlimentoPorTipo {
  const diaDe = (fecha: string) => diasEntre(lote.fechaInicio, fecha)
  const compras = comprasAlimento(gastos).filter((g) => (g.cantidadQq ?? 0) !== 0)

  const partidas: Partida[] = compras
    .filter((g) => (g.cantidadQq ?? 0) > 0)
    .map((g) => {
      const tipo = faseDeCompra(g)
      return {
        gastoId: g.id,
        fase: tipo ?? fasePlan(Math.max(0, diaDe(g.fecha))),
        supuesta: !tipo,
        nombre: g.descripcion?.trim() || undefined,
        fecha: g.fecha,
        qq: g.cantidadQq!,
        quedaLb: g.cantidadQq! * LB_POR_QUINTAL,
        precioQq: g.monto > 0 ? g.monto / g.cantidadQq! : undefined,
      }
    })
    .sort((a, b) => ordenFase(a.fase) - ordenFase(b.fase) || a.fecha.localeCompare(b.fecha) || a.gastoId - b.gastoId)

  const elegidos = new Map<number, FaseId>()
  for (const r of registros) if (r.alimentoFase) elegidos.set(diaDe(r.fecha), r.alimentoFase)

  // Lo dado: lo anotado o contado, y los días sin dato según la curva, igual que
  // la existencia del almacén. Hoy no cuenta: el alimento de hoy se anota al final.
  const consumo = m.alimento.dias.map((d) => ({ dia: d.dia, lb: d.lb, estimado: false }))
  const aves = m.avesVivas > 0 ? m.avesVivas : m.cantidadInicial
  const factorEf = eficienciaAlimento(m)
  for (let d = (m.diaAlimento ?? -1) + 1; d < m.dias; d++)
    consumo.push({ dia: d, lb: alimentoDiaEstandarLb(d) * aves * factorEf, estimado: true })
  consumo.sort((a, b) => a.dia - b.dia)

  const dias: DiaDeAlimento[] = []
  let ultimo: FaseId | undefined
  let sinCompraLb = 0
  // Lo dado de cada tipo sale de los sacos de ese tipo: el día en que se acaba
  // uno, lo que falta del día cuenta para el que sigue.
  const dado = new Map<FaseId, number>()
  const sumar = (f: FaseId, lb: number) => dado.set(f, (dado.get(f) ?? 0) + lb)
  const tomar = (p: Partida, lb: number) => {
    const resto = consumir(p, lb)
    sumar(p.fase, lb - resto)
    return resto
  }
  for (const c of consumo) {
    const elegido = elegidos.get(c.dia)
    let fase: FaseId
    if (elegido) fase = elegido
    else {
      const desde = ultimo ? ordenFase(ultimo) : 0
      const p = partidas.find((x) => x.quedaLb > 0.01 && ordenFase(x.fase) >= desde)
      fase = p ? p.fase : mayor(fasePlan(c.dia), ultimo)
    }
    ultimo = fase
    let resto = c.lb
    for (const p of partidas) if (resto > 0 && p.fase === fase) resto = tomar(p, resto)
    // Si se acabó a media jornada, el resto sale del que sigue.
    for (const p of partidas) if (resto > 0 && ordenFase(p.fase) > ordenFase(fase)) resto = tomar(p, resto)
    // Sin sacos que lo respalden, cuenta para el que se dio: falta una compra.
    if (resto > 0) sumar(fase, resto)
    sinCompraLb += resto
    dias.push({ dia: c.dia, fase, lb: c.lb, estimado: c.estimado, elegido: !!elegido })
  }

  // Lo que salió del almacén a otro ciclo se quita de lo que quedaba de ese tipo.
  for (const g of compras.filter((x) => (x.cantidadQq ?? 0) < 0)) {
    let resto = -g.cantidadQq! * LB_POR_QUINTAL
    const tipo = faseDeCompra(g)
    const orden = [...partidas].reverse()
    for (const p of orden) if (resto > 0 && (!tipo || p.fase === tipo)) resto = consumir(p, resto)
    for (const p of orden) if (resto > 0) resto = consumir(p, resto)
  }

  // Lo que se da hoy: lo elegido hoy, o lo que sigue de lo de ayer.
  const elegidoHoy = elegidos.get(m.dias)
  const desdeHoy = ultimo ? ordenFase(ultimo) : 0
  const conSacos = partidas.find((x) => x.quedaLb > 0.01 && ordenFase(x.fase) >= desdeHoy)
  const actual = elegidoHoy ?? (conSacos ? conSacos.fase : mayor(fasePlan(m.dias), ultimo))
  const siguiente = FASES[ordenFase(actual) + 1]
  const quedaActual = partidas.filter((p) => p.fase === actual).reduce((a, p) => a + p.quedaLb, 0)
  let alcanzaActual = 0
  for (let d = m.dias + 1, comido = 0; d <= m.dias + 60; d++) {
    comido += alimentoDiaEstandarLb(d) * aves * factorEf
    if (comido > quedaActual) break
    alcanzaActual++
  }

  const fases: ResumenFase[] = FASES.map((fase) => {
    const suyas = partidas.filter((p) => p.fase === fase)
    const salida = compras
      .filter((g) => (g.cantidadQq ?? 0) < 0 && faseDeCompra(g) === fase)
      .reduce((a, g) => a + g.cantidadQq!, 0)
    const delTipo = dias.filter((d) => d.fase === fase && d.lb > 0)
    const reciente = [...suyas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    return {
      fase,
      nombre: reciente?.nombre ?? nombreFase(fase),
      compradoQq: suyas.reduce((a, p) => a + p.qq, 0) + salida,
      dadoLb: dado.get(fase) ?? 0,
      quedaLb: suyas.reduce((a, p) => a + p.quedaLb, 0),
      desdeDia: delTipo[0]?.dia,
      hastaDia: delTipo[delTipo.length - 1]?.dia,
      precioQq: precioDeFase(fase, partidas, gastos, lote),
    }
  })

  return {
    dias,
    fases,
    partidas,
    actual,
    siguiente,
    alcanzaActual,
    supuestas: partidas.filter((p) => p.supuesta).length,
    sinCompraLb,
  }
}

/**
 * A cuánto sale el quintal de un tipo para lo que falta por comprar: lo último
 * que se pagó por ese tipo en este ciclo; si no, en otro ciclo de la granja; y
 * de último el promedio de lo comprado o el precio que se puso a mano.
 */
export function precioDeFase(fase: FaseId, partidas: Partida[], gastos: Gasto[], lote: Pick<Lote, 'precioQuintal'>) {
  const ultima = partidas
    .filter((p) => p.fase === fase && !p.supuesta && p.precioQq)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return (
    ultima?.precioQq ??
    getSettings().preciosAlimento[fase] ??
    precioQuintalReal(gastos) ??
    (lote.precioQuintal && lote.precioQuintal > 0 ? lote.precioQuintal : undefined)
  )
}

/**
 * La libra del alimento que se da ese día de edad, para lo que falta: la del
 * tipo que toca —nunca uno anterior al de hoy—, o `respaldoLb` si ese tipo no
 * tiene precio.
 */
export function precioDelDiaLb(apt: AlimentoPorTipo, dia: number, respaldoLb: number): number {
  const fase = mayor(fasePlan(dia), apt.actual)
  const qq = apt.fases.find((f) => f.fase === fase)?.precioQq
  return qq != null ? qq / LB_POR_QUINTAL : respaldoLb
}

export interface AlimentoFuturo {
  /** Lo que se va a comer de lo que ya está en el almacén. */
  delAlmacenLb: number
  /** Lo que falta comprar, por tipo. */
  comprar: { fase: FaseId; lb: number; precioQq?: number; costo?: number }[]
  comprarLb: number
  /** Lo que cuesta lo que falta, al precio de cada tipo; sin precio, undefined. */
  costo?: number
  /** Lo que sobra en el almacén al vender, y lo que se pagó por eso. */
  sobranteLb: number
  sobranteValor: number
}

/**
 * Lo que se va a dar desde mañana hasta `hasta`: primero los sacos del almacén
 * en su orden —también lo que sobró de un alimento anterior, que se mezcla—, y
 * lo que falte se compra del tipo que toca ese día, a su precio.
 */
export function alimentoFuturo(
  apt: AlimentoPorTipo,
  desde: number,
  hasta: number,
  lbDelDia: (dia: number) => number,
): AlimentoFuturo {
  const partidas = apt.partidas.map((p) => ({ ...p }))
  const porFase = new Map<FaseId, number>()
  let delAlmacenLb = 0
  let ultimo = apt.actual
  for (let d = desde + 1; d <= hasta; d++) {
    let resto = lbDelDia(d)
    if (!(resto > 0)) continue
    const p = partidas.find((x) => x.quedaLb > 0.01 && ordenFase(x.fase) >= ordenFase(ultimo))
    const fase = p ? p.fase : mayor(fasePlan(d), ultimo)
    ultimo = fase
    const antes = resto
    for (const x of partidas) if (resto > 0 && x.fase === fase) resto = consumir(x, resto)
    for (const x of partidas) if (resto > 0 && ordenFase(x.fase) > ordenFase(fase)) resto = consumir(x, resto)
    for (const x of partidas) if (resto > 0) resto = consumir(x, resto)
    delAlmacenLb += antes - resto
    if (resto > 0) porFase.set(fase, (porFase.get(fase) ?? 0) + resto)
  }
  const comprar = FASES.filter((f) => (porFase.get(f) ?? 0) > 0).map((fase) => {
    const lb = porFase.get(fase)!
    const precioQq = apt.fases.find((x) => x.fase === fase)?.precioQq
    return { fase, lb, precioQq, costo: precioQq != null ? (lb / LB_POR_QUINTAL) * precioQq : undefined }
  })
  const sinPrecio = comprar.some((c) => c.costo == null)
  return {
    delAlmacenLb,
    comprar,
    comprarLb: comprar.reduce((a, c) => a + c.lb, 0),
    costo: sinPrecio ? undefined : comprar.reduce((a, c) => a + (c.costo ?? 0), 0),
    sobranteLb: partidas.reduce((a, p) => a + p.quedaLb, 0),
    sobranteValor: partidas.reduce((a, p) => a + (p.precioQq ?? 0) * (p.quedaLb / LB_POR_QUINTAL), 0),
  }
}

/** «de engorde», «de crecimiento y engorde»: de qué es lo que falta comprar. */
export function deQueTipo(comprar: { fase: FaseId }[]): string {
  const nombres = comprar.map((c) => nombreFase(c.fase).toLowerCase())
  if (!nombres.length) return ''
  return `de ${nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]}`
}

/** Lo último que se pagó por cada tipo, en todas las compras de la granja. */
export function ultimosPrecios(gastos: Gasto[]): Partial<Record<FaseId, number>> {
  const out: Partial<Record<FaseId, { precio: number; fecha: string }>> = {}
  for (const g of comprasAlimento(gastos)) {
    if (g.traspaso || !((g.cantidadQq ?? 0) > 0) || !(g.monto > 0)) continue
    const fase = faseDeCompra(g)
    if (!fase) continue
    const ya = out[fase]
    if (!ya || g.fecha > ya.fecha) out[fase] = { precio: g.monto / g.cantidadQq!, fecha: g.fecha }
  }
  return Object.fromEntries(Object.entries(out).map(([f, v]) => [f, v!.precio])) as Partial<Record<FaseId, number>>
}
