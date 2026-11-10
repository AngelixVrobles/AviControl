import type { Ingreso, Lote, Pesaje, Registro } from '../db/schema'
import { diasEntre } from './format'
import { pesoEstandarLb } from './standards'
import { lbEnPieDe } from './venta'
import { bajasEntre, DIA_POLLO_GRANDE, type Bajas } from './ritmoBajas'
import { mezclaDeCiclo, mezclaDeGranja, type MezclaCiclo, type MezclaGranja } from './mezcla'

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

// La báscula de la granja no es la del pollero: se agarran las que se dejan, y
// en el ayuno antes de cargar los pollos bajan. Lo que se aparta una de otra se
// aprende de las polladas que se pesaron poco antes de vender; mientras no hay,
// se supone que puede ser hasta un 10 % para arriba o para abajo.
const SESGO_ANTES = 0.05
/** Un pesaje enseña lo que se aparta la báscula si fue hasta estos días antes de vender. */
export const DIAS_PESAJE_ANTES = 10
// Lo que se equivoca el peso de una venta: las aves que se anotaron por caja.
const VAR_VENTA = 0.02 ** 2

// Lo que aprende de una pollada cerrada: a qué parte del Cobb vendió.
export interface CicloAprendido {
  /** Lo que pesó en pie cada pollo vendido contra el Cobb del día de la venta. */
  factor: number
  /** El día de venta, pesado por las aves de cada venta. */
  dia: number
  aves: number
  fechaCierre: string
  /**
   * Lo que el último pesaje antes de vender daba de más contra lo que pagó el
   * pollero, en logaritmo, y qué tanto creerle. Solo si se pesó cerca de la venta.
   */
  sesgo?: { valor: number; varianza: number }
  /** Lo que se murió con el pollo grande, del día 22 a la venta. */
  bajasTarde?: Bajas
  /** Lo que se vendió aparte de la venta grande, y lo que dejó. */
  mezcla?: MezclaCiclo
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
  /**
   * Lo que su báscula da de más contra la del pollero, en logaritmo, y qué tan
   * seguro: sin polladas pesadas cerca de la venta, 0 con el margen de cualquier granja.
   */
  sesgo: number
  sesgoSd: number
  /** De cuántas polladas lo aprendió. */
  ciclosSesgo: number
  /** Lo que se le muere a una de sus polladas con el pollo grande, en promedio. */
  bajasTarde?: Bajas
  /** Qué parte de sus aves vende aparte, y cuánto más le dejan. */
  mezcla?: MezclaGranja
}

/** A qué parte del Cobb vendió una pollada cerrada, por lo que pesaron sus ventas. */
export function cicloAprendido(
  lote: Pick<Lote, 'fechaInicio' | 'fechaCierre' | 'estado' | 'cantidadInicial' | 'muertosLlegada'>,
  ingresos: Ingreso[],
  registros: Registro[] = [],
  pesajes: Pesaje[] = [],
): CicloAprendido | undefined {
  if (lote.estado !== 'cerrado') return undefined
  const pesadas = ingresos.filter((i) => i.tipo === 'aves' && (i.pesoLb ?? 0) > 0 && i.cantidad > 0)
  let aves = 0
  let sumaLog = 0
  let sumaDia = 0
  let primerDia = Infinity
  let ultimoDia = -Infinity
  for (const i of pesadas) {
    const dia = Math.max(1, diasEntre(lote.fechaInicio, i.fecha))
    const factor = lbEnPieDe(i) / i.cantidad / pesoEstandarLb(dia)
    if (!(factor > 0)) continue
    aves += i.cantidad
    sumaLog += Math.log(factor) * i.cantidad
    sumaDia += dia * i.cantidad
    primerDia = Math.min(primerDia, dia)
    ultimoDia = Math.max(ultimoDia, dia)
  }
  // Pocas aves, o un peso que no puede ser, no enseñan nada.
  if (aves < 10) return undefined
  const factor = Math.exp(sumaLog / aves)
  if (factor < 0.4 || factor > 1.6) return undefined
  const dia = sumaDia / aves

  // El último pesaje de poco antes de vender —o entre una venta y otra— contra
  // lo que pagó el pollero: los dos contra el Cobb de su día, porque en esos
  // días el pollo sigue creciendo. Una diferencia que no puede ser es un
  // pesaje mal anotado.
  const cerca = pesadasDelLote(lote, registros, pesajes).filter(
    (p) => p.dia <= ultimoDia && p.dia >= primerDia - DIAS_PESAJE_ANTES,
  )
  const p = cerca[cerca.length - 1]
  let sesgo: CicloAprendido['sesgo']
  if (p) {
    const valor = Math.log(p.pesoLb / curva(p.dia)) - Math.log(factor)
    const varianza = ruidoPesaje(p.n, p.cv) + DERIVA_DIARIA * Math.abs(dia - p.dia) + VAR_VENTA
    if (Math.abs(valor) <= 0.4) sesgo = { valor, varianza }
  }
  const bajas = bajasEntre(lote, registros, ingresos, DIA_POLLO_GRANDE)
  const mezcla = mezclaDeCiclo(ingresos)
  return {
    factor,
    dia,
    aves,
    fechaCierre: lote.fechaCierre ?? '',
    ...(sesgo ? { sesgo } : {}),
    ...(bajas.exposicion > 0 ? { bajasTarde: bajas } : {}),
    ...(mezcla ? { mezcla } : {}),
  }
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
  // Lo que se aparta la báscula, de las polladas que se pesaron cerca de la
  // venta: acercado a cero mientras sean pocas, porque con una sola no se le
  // cree todo.
  let suma = 0
  let precision = 1 / SESGO_ANTES ** 2
  let ciclosSesgo = 0
  ultimos.forEach((c, k) => {
    if (!c.sesgo) return
    const w = pesos[k] / c.sesgo.varianza
    suma += w * c.sesgo.valor
    precision += w
    ciclosSesgo++
  })
  const mezcla = mezclaDeGranja(ultimos.map((c, k) => ({ mezcla: c.mezcla, peso: pesos[k] })))
  // Lo que se muere con el pollo grande, como en una pollada de las suyas: el
  // promedio, con las recientes pesando más, y no la suma, para que muchas
  // polladas no tapen lo que pasa en la de ahora.
  let pesoBajas = 0
  let muertes = 0
  let exposicion = 0
  ultimos.forEach((c, k) => {
    if (!c.bajasTarde) return
    pesoBajas += pesos[k]
    muertes += pesos[k] * c.bajasTarde.muertes
    exposicion += pesos[k] * c.bajasTarde.exposicion
  })
  return {
    ciclos: n,
    factor: Math.exp(nivel),
    nivel,
    dispersion,
    diaVenta,
    sesgo: suma / precision,
    sesgoSd: Math.sqrt(1 / precision),
    ciclosSesgo,
    ...(pesoBajas > 0 ? { bajasTarde: { muertes: muertes / pesoBajas, exposicion: exposicion / pesoBajas } } : {}),
    ...(mezcla ? { mezcla } : {}),
  }
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
  /** Lo que se espera que pese cada pollo ese día, en la báscula de la granja. */
  pesoEn(dia: number): number
  /** Entre cuánto y cuánto puede pesar, con 8 de cada 10 de probabilidad. */
  rangoEn(dia: number): [number, number]
  /** Qué parte del Cobb rinde el lote ese día. */
  factorEn(dia: number): number
  /** Qué tan seguro: la desviación del logaritmo ese día. */
  sdEn(dia: number): number
  /**
   * Lo que pesaría cada pollo en la báscula del pollero si se vende ese día: el
   * que se cobra. Es el de la granja menos lo que su báscula da de más.
   */
  ventaEn(dia: number): number
  rangoVentaEn(dia: number): [number, number]
  sdVentaEn(dia: number): number
  /** Lo que la báscula de la granja da de más contra la del pollero, en fracción: 0.05 es 5 %. */
  sesgo: number
  /**
   * Lo que quedaría el margen —la mitad del rango, en fracción del peso— del
   * peso al vender el día `objetivo` si el día `diaPesaje` se pesan `n` aves.
   */
  margenSiPesa(n: number, diaPesaje: number, objetivo: number): number
}

const curva = (dia: number) => pesoEstandarLb(dia)

// Lo que se sabe del lote un día: qué parte del Cobb pesaría en la báscula del
// pollero (x), lo que la de la granja da de más (b), y qué tan seguro de cada
// cosa y de las dos juntas.
interface Estado {
  dia: number
  x: number
  b: number
  xx: number
  xb: number
  bb: number
}

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
  // adelante, como antes, pero el margen crece con los días que pasan. Sin
  // ventas no hay con qué comparar la báscula: se cobra lo que pesa.
  if (!perfil) {
    const x = xDe(ultimo)
    const v0 = ruidoPesaje(ultimo.n, ultimo.cv)
    const varEn = (dia: number) => v0 + DERIVA_DIARIA * Math.abs(dia - ultimo.dia)
    const pesoEn = (dia: number) =>
      dia >= ultimo.dia ? Math.max(ultimo.pesoLb, curva(dia) * Math.exp(x)) : curva(dia) * Math.exp(x)
    const rangoEn = (dia: number): [number, number] => {
      const s = Math.sqrt(varEn(dia))
      return [curva(dia) * Math.exp(x - Z_80 * s), curva(dia) * Math.exp(x + Z_80 * s)]
    }
    const sdEn = (dia: number) => Math.sqrt(varEn(dia))
    return {
      conHistoria: false,
      pesadas,
      ultimo,
      pesoEn,
      rangoEn,
      factorEn: () => Math.exp(x),
      sdEn,
      ventaEn: pesoEn,
      rangoVentaEn: rangoEn,
      sdVentaEn: sdEn,
      sesgo: 0,
      margenSiPesa: (n, diaPesaje, objetivo) => {
        const v = ruidoPesaje(n, ultimo.cv) + DERIVA_DIARIA * Math.abs(objetivo - diaPesaje)
        return Math.exp(Z_80 * Math.sqrt(v)) - 1
      },
    }
  }

  // Con polladas cerradas: el camino de la granja va del Cobb al nacer a lo que
  // logra al vender, y lo que el lote se aparta de él se va yendo poco a poco.
  // Cada día, además, puede cambiar: lo que cambia de una pollada a otra se
  // va juntando con los días. Todo eso en la báscula del pollero, que es la que
  // dicen las ventas; un pesaje es eso más lo que se aparta la de la granja,
  // que también se va afinando con cada pesaje.
  const D = Math.max(21, perfil.diaVenta)
  const mu = (dia: number) => Math.log(1 + (perfil.factor - 1) * Math.min(1, Math.max(0, dia) / D))
  const q = THETA * perfil.dispersion ** 2
  const avanzar = (s: Estado, hasta: number): Estado => {
    const dias = Math.max(0, hasta - s.dia)
    const a = Math.exp(-THETA * dias)
    return {
      dia: s.dia + dias,
      x: mu(s.dia + dias) + (s.x - mu(s.dia)) * a,
      b: s.b,
      xx: s.xx * a * a + q * dias,
      xb: s.xb * a,
      bb: s.bb,
    }
  }
  // Lo que se esperaba que diera la báscula contra lo que dio: la diferencia
  // se reparte entre el lote y la báscula según lo que se sabía de cada uno.
  const pesar = (s: Estado, z: number, r: number): Estado => {
    const cx = s.xx + s.xb
    const cb = s.xb + s.bb
    const total = cx + cb + r
    const kx = cx / total
    const kb = cb / total
    const sorpresa = z - (s.x + s.b)
    return {
      dia: s.dia,
      x: s.x + kx * sorpresa,
      b: s.b + kb * sorpresa,
      xx: s.xx - kx * cx,
      xb: s.xb - kx * cb,
      bb: s.bb - kb * cb,
    }
  }

  // Al nacer, todos los pollitos van con la curva; de la báscula se sabe lo que
  // enseñaron las polladas cerradas.
  let s: Estado = { dia: 0, x: mu(0), b: perfil.sesgo, xx: 0, xb: 0, bb: perfil.sesgoSd ** 2 }
  for (const p of pesadas) s = pesar(avanzar(s, p.dia), xDe(p), ruidoPesaje(p.n, p.cv))
  const U = s
  const estado = (d: number): Estado => (d >= U.dia ? avanzar(U, d) : { ...U, dia: d, x: mu(d) + (U.x - mu(U.dia)) })
  const enBascula = (e: Estado): [number, number] => [e.x + e.b, e.xx + 2 * e.xb + e.bb]
  const rango = (d: number, x: number, v: number): [number, number] => {
    const sd = Math.sqrt(Math.max(0, v))
    return [curva(d) * Math.exp(x - Z_80 * sd), curva(d) * Math.exp(x + Z_80 * sd)]
  }
  // Los pollos no bajan de peso: después del último pesaje, nunca menos de lo
  // que se calculaba ese día.
  const pesoU = curva(U.dia) * Math.exp(U.x + U.b)
  const ventaU = curva(U.dia) * Math.exp(U.x)
  return {
    conHistoria: true,
    perfil,
    pesadas,
    ultimo,
    pesoEn: (d) => {
      const p = curva(d) * Math.exp(enBascula(estado(d))[0])
      return d >= U.dia ? Math.max(pesoU, p) : p
    },
    rangoEn: (d) => rango(d, ...enBascula(estado(d))),
    factorEn: (d) => Math.exp(enBascula(estado(d))[0]),
    sdEn: (d) => Math.sqrt(enBascula(estado(d))[1]),
    ventaEn: (d) => {
      const p = curva(d) * Math.exp(estado(d).x)
      return d >= U.dia ? Math.max(ventaU, p) : p
    },
    rangoVentaEn: (d) => {
      const e = estado(d)
      return rango(d, e.x, e.xx)
    },
    sdVentaEn: (d) => Math.sqrt(estado(d).xx),
    sesgo: Math.exp(U.b) - 1,
    margenSiPesa: (n, diaPesaje, objetivo) => {
      const antes = estado(Math.max(U.dia, diaPesaje))
      const despues = pesar(antes, antes.x + antes.b, ruidoPesaje(n, ultimo.cv))
      return Math.exp(Z_80 * Math.sqrt(avanzar(despues, Math.max(despues.dia, objetivo)).xx)) - 1
    },
  }
}

/** El primer día en que se espera que lleguen a `objetivo` en la báscula del pollero; hasta el día 84. */
export function diaParaPesoEstimado(e: EstimadorPeso, objetivoLb: number, tope = 84): number {
  for (let d = 1; d <= tope; d++) if (e.ventaEn(d) >= objetivoLb) return d
  return tope
}

/** El margen que se le cree al peso al vender: la mitad del rango, en fracción. */
export function margenRelativo(e: EstimadorPeso, dia: number): number {
  return Math.exp(Z_80 * e.sdVentaEn(dia)) - 1
}
