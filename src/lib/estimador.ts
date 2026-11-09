import type { Ingreso, Lote, Pesaje, Registro } from '../db/schema'
import { diasEntre } from './format'
import { pesoEstandarLb } from './standards'
import { lbEnPieDe } from './venta'

// Cuánto van a pesar los pollos, lo más cerca de la realidad que se puede
// saber, y con qué tanta seguridad.
//
// Se sigue qué parte del peso Cobb lleva el lote —su logaritmo, que se aparta
// parejo arriba y abajo de la curva— con un filtro de Kalman: cada pesaje es
// una medida con su error, que depende de cuántas aves se pesaron y de qué tan
// desparejas están, más el sesgo de agarrar las que se dejan. Entre un pesaje
// y otro, el lote se va pareciendo a lo que de verdad logra esta granja: lo
// que pesaron sus pollos vendidos en las polladas que ya cerraron, contra el
// Cobb de ese día. Un lote que a los 28 días iba 11 % arriba de la curva no
// llega así a la venta si la granja vende siempre al 79 %: el modelo lo dice,
// y dice el rango en que puede quedar.
//
// Una pollada cerró diciendo que los pollos pesaban 7.76 lb y se vendieron a
// 5.49: el último pesaje se estiró con la curva Cobb dos semanas, sin margen y
// sin mirar lo que la granja había logrado antes.

/** Con 8 de cada 10 de probabilidad, el valor queda en el rango. */
const Z_80 = 1.2816

/**
 * Lo que se equivoca un pesaje aunque se pesen muchas aves: se agarran las
 * que se dejan, que no son el promedio del galpón.
 */
export const SESGO_PESAJE = 0.03

// Un pesaje anotado sin la báscula de la app no dice cuántas se pesaron.
const N_SIN_DETALLE = 10
const CV_TIPICO = 0.1

// Sin polladas anteriores, cuánto puede cambiar por día lo que rinde el lote
// contra la curva: la varianza del logaritmo crece esto cada día.
const DERIVA_DIARIA = 0.0003

/** Con historia, en cuántos días se va la mitad de lo que el lote se aparta de lo de la granja. */
export const VIDA_MEDIA_DIAS = 12
const THETA = Math.LN2 / VIDA_MEDIA_DIAS

// Lo que aprende de una pollada cerrada: a qué parte del Cobb vendió.
export interface CicloAprendido {
  /** Lo que pesó en pie cada pollo vendido contra el Cobb del día de la venta. */
  factor: number
  /** El día de venta, pesado por las aves de cada venta. */
  dia: number
  aves: number
  fechaCierre: string
}

export interface PerfilGranja {
  /** Cuántas polladas cerradas, con ventas pesadas, lo forman. */
  ciclos: number
  /** A qué parte del peso Cobb llegan sus pollos a la venta. */
  factor: number
  /** Lo mismo, en logaritmo: el nivel al que vuelve el lote. */
  nivel: number
  /** Qué tanto cambia de una pollada a otra, en logaritmo. */
  dispersion: number
  /** El día en que suele vender. */
  diaVenta: number
}

/** A qué parte del Cobb vendió una pollada cerrada, por lo que pesaron sus ventas. */
export function cicloAprendido(
  lote: Pick<Lote, 'fechaInicio' | 'fechaCierre' | 'estado'>,
  ingresos: Ingreso[],
): CicloAprendido | undefined {
  if (lote.estado !== 'cerrado') return undefined
  const pesadas = ingresos.filter((i) => i.tipo === 'aves' && (i.pesoLb ?? 0) > 0 && i.cantidad > 0)
  let aves = 0
  let sumaLog = 0
  let sumaDia = 0
  for (const i of pesadas) {
    const dia = Math.max(1, diasEntre(lote.fechaInicio, i.fecha))
    const factor = lbEnPieDe(i) / i.cantidad / pesoEstandarLb(dia)
    if (!(factor > 0)) continue
    aves += i.cantidad
    sumaLog += Math.log(factor) * i.cantidad
    sumaDia += dia * i.cantidad
  }
  // Pocas aves, o un peso que no puede ser, no enseñan nada.
  if (aves < 10) return undefined
  const factor = Math.exp(sumaLog / aves)
  if (factor < 0.4 || factor > 1.6) return undefined
  return { factor, dia: sumaDia / aves, aves, fechaCierre: lote.fechaCierre ?? '' }
}

/**
 * Lo que logra la granja, de sus últimas polladas: las más recientes pesan más.
 * Con pocas, lo que cambia de una a otra se supone como en cualquier granja.
 */
export function perfilDeGranja(ciclos: CicloAprendido[]): PerfilGranja | undefined {
  const ultimos = [...ciclos].sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre)).slice(0, 6)
  if (!ultimos.length) return undefined
  const pesos = ultimos.map((_, k) => 0.75 ** k)
  const total = pesos.reduce((a, w) => a + w, 0)
  const nivel = ultimos.reduce((a, c, k) => a + pesos[k] * Math.log(c.factor), 0) / total
  const varianza = ultimos.reduce((a, c, k) => a + pesos[k] * (Math.log(c.factor) - nivel) ** 2, 0) / total
  // Lo que se ve en sus polladas, acercado a un 10 % mientras sean pocas.
  const n = ultimos.length
  const dispersion = Math.max(0.06, Math.sqrt((2 * 0.1 ** 2 + n * varianza) / (2 + n)))
  const diaVenta = ultimos.reduce((a, c, k) => a + pesos[k] * c.dia, 0) / total
  return { ciclos: n, factor: Math.exp(nivel), nivel, dispersion, diaVenta }
}

// Un pesaje del lote: el día, el promedio, y con cuántas aves y qué tan
// desparejas, que dicen cuánto creerle.
export interface PesadaLote {
  dia: number
  pesoLb: number
  n: number
  cv: number
}

export function pesadasDelLote(
  lote: Pick<Lote, 'fechaInicio'>,
  registros: Registro[],
  pesajes: Pesaje[] = [],
): PesadaLote[] {
  return registros
    .filter((r) => Number.isFinite(r.pesoPromedio) && r.pesoPromedio! > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((r) => {
      const pesos = pesajes.find((p) => p.fecha === r.fecha)?.pesos.filter((x) => x > 0) ?? []
      const n = pesos.length
      let cv = CV_TIPICO
      if (n >= 2) {
        const media = pesos.reduce((a, x) => a + x, 0) / n
        const sd = Math.sqrt(pesos.reduce((a, x) => a + (x - media) ** 2, 0) / (n - 1))
        if (media > 0) cv = sd / media
      }
      return {
        dia: diasEntre(lote.fechaInicio, r.fecha),
        pesoLb: r.pesoPromedio!,
        n: n >= 2 ? n : N_SIN_DETALLE,
        cv,
      }
    })
}

/** Lo que se equivoca un pesaje: el error de la muestra más el de agarrar las que se dejan. */
export const ruidoPesaje = (n: number, cv: number) => cv ** 2 / Math.max(1, n) + SESGO_PESAJE ** 2

export interface EstimadorPeso {
  /** Aprende de las polladas cerradas de la granja. */
  conHistoria: boolean
  perfil?: PerfilGranja
  pesadas: PesadaLote[]
  ultimo: PesadaLote
  /** Lo que se espera que pese cada pollo ese día. */
  pesoEn(dia: number): number
  /** Entre cuánto y cuánto puede pesar, con 8 de cada 10 de probabilidad. */
  rangoEn(dia: number): [number, number]
  /** Qué parte del Cobb rinde el lote ese día. */
  factorEn(dia: number): number
  /** Qué tan seguro: la desviación del logaritmo ese día. */
  sdEn(dia: number): number
  /**
   * Lo que quedaría el margen —la mitad del rango, en fracción del peso— del
   * día `objetivo` si el día `diaPesaje` se pesan `n` aves.
   */
  margenSiPesa(n: number, diaPesaje: number, objetivo: number): number
}

const curva = (dia: number) => pesoEstandarLb(dia)

export function estimarPeso(
  lote: Pick<Lote, 'fechaInicio'>,
  registros: Registro[],
  pesajes: Pesaje[] = [],
  perfil?: PerfilGranja,
): EstimadorPeso | undefined {
  const pesadas = pesadasDelLote(lote, registros, pesajes)
  if (!pesadas.length) return undefined
  const ultimo = pesadas[pesadas.length - 1]
  const xDe = (p: PesadaLote) => Math.log(p.pesoLb / curva(p.dia))

  // Sin polladas cerradas: lo que dijo el último pesaje sigue igual hacia
  // adelante, como antes, pero el margen crece con los días que pasan.
  if (!perfil) {
    const x = xDe(ultimo)
    const v0 = ruidoPesaje(ultimo.n, ultimo.cv)
    const varEn = (dia: number) => v0 + DERIVA_DIARIA * Math.abs(dia - ultimo.dia)
    const pesoEn = (dia: number) =>
      dia >= ultimo.dia ? Math.max(ultimo.pesoLb, curva(dia) * Math.exp(x)) : curva(dia) * Math.exp(x)
    return {
      conHistoria: false,
      pesadas,
      ultimo,
      pesoEn,
      rangoEn: (dia) => {
        const s = Math.sqrt(varEn(dia))
        return [curva(dia) * Math.exp(x - Z_80 * s), curva(dia) * Math.exp(x + Z_80 * s)]
      },
      factorEn: () => Math.exp(x),
      sdEn: (dia) => Math.sqrt(varEn(dia)),
      margenSiPesa: (n, diaPesaje, objetivo) => {
        const v = ruidoPesaje(n, ultimo.cv) + DERIVA_DIARIA * Math.abs(objetivo - diaPesaje)
        return Math.exp(Z_80 * Math.sqrt(v)) - 1
      },
    }
  }

  // Con polladas cerradas: el camino de la granja va del Cobb al nacer a lo que
  // logra al vender, y lo que el lote se aparta de él se va yendo poco a poco.
  // Cada día, además, puede cambiar: lo que cambia de una pollada a otra se
  // va juntando con los días.
  const D = Math.max(21, perfil.diaVenta)
  const mu = (dia: number) => Math.log(1 + (perfil.factor - 1) * Math.min(1, Math.max(0, dia) / D))
  const q = THETA * perfil.dispersion ** 2
  const avanzar = (m: number, v: number, desde: number, hasta: number): [number, number] => {
    const dias = Math.max(0, hasta - desde)
    const a = Math.exp(-THETA * dias)
    return [mu(hasta) + (m - mu(desde)) * a, v * a * a + q * dias]
  }

  // El filtro: de pesaje en pesaje, lo que se esperaba contra lo que se pesó.
  // Al nacer, todos los pollitos van con la curva.
  let m = mu(0)
  let v = 0
  let dia = 0
  for (const p of pesadas) {
    ;[m, v] = avanzar(m, v, dia, p.dia)
    const r = ruidoPesaje(p.n, p.cv)
    const k = v / (v + r)
    m += k * (xDe(p) - m)
    v *= 1 - k
    dia = p.dia
  }
  const mU = m
  const vU = v
  const dU = ultimo.dia
  const estado = (d: number): [number, number] =>
    d >= dU ? avanzar(mU, vU, dU, d) : [mu(d) + (mU - mu(dU)), vU]
  // Los pollos no bajan de peso: después del último pesaje, nunca menos de lo
  // que se calculaba ese día.
  const pesoU = curva(dU) * Math.exp(mU)
  const pesoEn = (d: number) => {
    const p = curva(d) * Math.exp(estado(d)[0])
    return d >= dU ? Math.max(pesoU, p) : p
  }
  return {
    conHistoria: true,
    perfil,
    pesadas,
    ultimo,
    pesoEn,
    rangoEn: (d) => {
      const [x, varianza] = estado(d)
      const s = Math.sqrt(varianza)
      return [curva(d) * Math.exp(x - Z_80 * s), curva(d) * Math.exp(x + Z_80 * s)]
    },
    factorEn: (d) => Math.exp(estado(d)[0]),
    sdEn: (d) => Math.sqrt(estado(d)[1]),
    margenSiPesa: (n, diaPesaje, objetivo) => {
      const [, vP] = estado(diaPesaje)
      const r = ruidoPesaje(n, ultimo.cv)
      const vDespues = (vP * r) / (vP + r)
      const [, vObj] = avanzar(0, vDespues, diaPesaje, Math.max(diaPesaje, objetivo))
      return Math.exp(Z_80 * Math.sqrt(vObj)) - 1
    },
  }
}

/** El primer día en que se espera que lleguen a `objetivo`; hasta el día 84. */
export function diaParaPesoEstimado(e: EstimadorPeso, objetivoLb: number, tope = 84): number {
  for (let d = 1; d <= tope; d++) if (e.pesoEn(d) >= objetivoLb) return d
  return tope
}

/** El margen que se le cree a un peso: la mitad del rango, en fracción. */
export function margenRelativo(e: EstimadorPeso, dia: number): number {
  return Math.exp(Z_80 * e.sdEn(dia)) - 1
}
