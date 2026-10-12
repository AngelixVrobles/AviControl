import type { EntregaSocio, Gasto, Ingreso, Lote, Socio } from '../db/schema'
import type { LoteMetrics } from './metrics'

export interface SocioBalance {
  nombre: string
  pct: number
  /** Lo que pagó de su bolsillo: los pollitos y los gastos, o su parte de lo común. */
  aporte: number
  /** Lo que le entró de las ventas. */
  cobrado: number
  /** Lo que les dio a los otros socios. */
  entregado: number
  /** Lo que los otros socios le dieron. */
  recibido: number
  /** Su parte de los costos del ciclo según el acuerdo. */
  leTocaPoner: number
  /** Su ganancia: su parte de la ganancia del ciclo. */
  corresponde: number
  /**
   * Lo que le falta para quedar según el acuerdo. Positivo: le falta recibir
   * (o, antes de vender, puso de más). Negativo: tiene de más (o le falta poner).
   */
  ajuste: number
}

export interface Traspaso {
  de: string
  a: string
  deIdx: number
  aIdx: number
  monto: number
}

export interface Liquidacion {
  socios: SocioBalance[]
  ganancia: number
  costos: number
  ingresos: number
  /** Ya entró dinero de ventas: la cuenta pasa de «lo que puso» a «lo que le toca». */
  conVentas: boolean
  /** Lo que se ha movido entre socios con entregas anotadas. */
  movido: number
  /** Cómo se lee el reparto: «mitad y mitad», «en partes iguales», «60/40». */
  acuerdo: string
  traspasos: Traspaso[]
}

const norm = (socios: Socio[]): number[] => {
  const total = socios.reduce((a, s) => a + (s.pct || 0), 0)
  return total > 0 ? socios.map((s) => (s.pct || 0) / total) : socios.map(() => 1 / socios.length)
}

export const nombreSocio = (s: Socio, i: number) => s.nombre.trim() || `Socio ${i + 1}`

function leerAcuerdo(fr: number[]): string {
  if (fr.every((f) => Math.abs(f - fr[0]) < 1e-9))
    return fr.length === 2 ? 'mitad y mitad' : 'en partes iguales'
  return fr.map((f) => Math.round(f * 100)).join('/')
}

export function computeLiquidacion(
  lote: Lote,
  gastos: Gasto[],
  ingresos: Ingreso[],
  m: LoteMetrics,
  entregas: EntregaSocio[] = [],
): Liquidacion | null {
  const socios = lote.socios
  if (!socios || socios.length < 2) return null

  const fr = norm(socios)
  const aporte = socios.map(() => 0)
  const cobrado = socios.map(() => 0)
  const entregado = socios.map(() => 0)
  const recibido = socios.map(() => 0)
  const valido = (i: number) => Number.isInteger(i) && i >= 0 && i < socios.length

  const repartir = (destino: number[], monto: number, quien: number | undefined) => {
    if (quien != null && valido(quien)) destino[quien] += monto
    else fr.forEach((f, i) => (destino[i] += monto * f))
  }

  repartir(aporte, lote.costoInicial, lote.costoInicialPagadoPor)
  for (const g of gastos) repartir(aporte, g.monto, g.pagadoPor)
  for (const i of ingresos) repartir(cobrado, i.monto, i.recibidoPor)

  let movido = 0
  for (const e of entregas) {
    if (!valido(e.de) || !valido(e.a) || e.de === e.a || !(e.monto > 0)) continue
    entregado[e.de] += e.monto
    recibido[e.a] += e.monto
    movido += e.monto
  }

  // Lo que cada uno tiene en la mano por el ciclo —lo que cobró y le dieron,
  // menos lo que puso y entregó— tiene que terminar siendo su parte de la
  // ganancia. Antes de vender la ganancia es menos los costos, y la misma
  // cuenta dice quién ha puesto de más.
  const balances: SocioBalance[] = socios.map((s, i) => {
    const corresponde = fr[i] * m.ganancia
    const enMano = cobrado[i] + recibido[i] - aporte[i] - entregado[i]
    return {
      nombre: nombreSocio(s, i),
      pct: fr[i] * 100,
      aporte: aporte[i],
      cobrado: cobrado[i],
      entregado: entregado[i],
      recibido: recibido[i],
      leTocaPoner: fr[i] * m.costos,
      corresponde,
      ajuste: corresponde - enMano,
    }
  })

  return {
    socios: balances,
    ganancia: m.ganancia,
    costos: m.costos,
    ingresos: m.ingresos,
    conVentas: m.ingresos > 0,
    movido,
    acuerdo: leerAcuerdo(fr),
    traspasos: liquidar(balances),
  }
}

// Salda los ajustes: quien tiene ajuste negativo le paga a quien lo tiene positivo.
function liquidar(balances: SocioBalance[]): Traspaso[] {
  const deben = balances.map((b, i) => ({ i, x: b.ajuste })).filter((b) => Math.abs(b.x) >= 1)
  const acreedores = deben.filter((b) => b.x > 0).sort((a, b) => b.x - a.x)
  const deudores = deben.filter((b) => b.x < 0).map((b) => ({ ...b, x: -b.x })).sort((a, b) => b.x - a.x)

  const out: Traspaso[] = []
  let ai = 0
  for (const d of deudores) {
    let resto = d.x
    while (resto >= 1 && ai < acreedores.length) {
      const a = acreedores[ai]
      const monto = Math.min(resto, a.x)
      out.push({
        de: balances[d.i].nombre,
        a: balances[a.i].nombre,
        deIdx: d.i,
        aIdx: a.i,
        monto: Math.round(monto),
      })
      resto -= monto
      a.x -= monto
      if (a.x < 1) ai++
    }
  }
  return out
}

export const esYo = (nombre: string) => nombre.trim().toLowerCase() === 'yo'

/**
 * La frase de una entrega, partida alrededor del monto para poder resaltarlo.
 * «Yo» es quien usa la app: la app le habla de tú («Le entregas…», «… te
 * entrega») y en el mensaje que manda habla él («Le entrego…», «… me
 * entrega»). «Socio le paga a Yo» no lo dice nadie.
 */
export function fraseEntrega(
  de: string,
  a: string,
  { voz = 'app', hecha = false }: { voz?: 'app' | 'propia'; hecha?: boolean } = {},
): [string, string] {
  const app = voz === 'app'
  if (esYo(de)) {
    const verbo = app ? (hecha ? 'Le entregaste' : 'Le entregas') : hecha ? 'Le entregué' : 'Le entrego'
    return [`${verbo} `, ` a ${a}`]
  }
  if (esYo(a)) {
    const pron = app ? 'te' : 'me'
    return [`${de} ${pron} ${hecha ? 'entregó' : 'entrega'} `, '']
  }
  return [`${de} le ${hecha ? 'entregó' : 'entrega'} `, ` a ${a}`]
}

export interface GananciaSocio {
  nombre: string
  pct: number
  monto: number
}

/** Reparte la ganancia de uno o varios ciclos entre quienes la llevan. */
export function gananciaPorSocio(ciclos: { socios?: Socio[]; ganancia: number }[]): {
  socios: GananciaSocio[]
  sinSociedad: number
} {
  const acumulado = new Map<string, GananciaSocio>()
  let sinSociedad = 0

  for (const c of ciclos) {
    if (!c.socios || c.socios.length < 2) {
      sinSociedad += c.ganancia
      continue
    }
    const fr = norm(c.socios)
    c.socios.forEach((s, i) => {
      const previo = acumulado.get(s.nombre)
      acumulado.set(s.nombre, {
        nombre: s.nombre,
        pct: fr[i] * 100,
        monto: (previo?.monto ?? 0) + fr[i] * c.ganancia,
      })
    })
  }

  return { socios: [...acumulado.values()], sinSociedad }
}
