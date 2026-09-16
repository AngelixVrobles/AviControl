export interface EscalaY {
  desde: number
  hasta: number
  marcas: number[]
}

function pasoBonito(span: number, divisiones: number): number {
  const bruto = span / divisiones
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const normalizado = bruto / magnitud
  const escalon =
    normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10
  return escalon * magnitud
}

/**
 * El dominio se pega a los datos y las marcas caen en valores redondos dentro
 * de él. Estirar el dominio hasta la marca siguiente, que es lo que hacen las
 * librerías por defecto, deja la curva aplastada en tres cuartos del alto.
 */
export function escalaY(min: number, max: number, divisiones = 3): EscalaY {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { desde: 0, hasta: 1, marcas: [0, 1] }
  if (max - min <= 0) {
    const margen = Math.abs(max) || 1
    return escalaY(min - margen / 2, max + margen / 2, divisiones)
  }

  const span = max - min
  const desde = min >= 0 && min <= span / 2 ? 0 : min - span * 0.06
  const hasta = max + span * 0.06

  let paso = pasoBonito(span, divisiones)
  let marcas = marcasEn(desde, hasta, paso)
  if (marcas.length < 2) {
    paso /= 2
    marcas = marcasEn(desde, hasta, paso)
  }
  return { desde, hasta, marcas }
}

function marcasEn(desde: number, hasta: number, paso: number): number[] {
  const marcas: number[] = []
  for (let v = Math.ceil(desde / paso) * paso; v <= hasta; v += paso) marcas.push(redondear(v))
  return marcas
}

const redondear = (v: number) => Number(v.toPrecision(12))

export interface PuntoBanda {
  x: number
  a: number
  b: number
}

export interface TramoBanda {
  signo: 1 | -1
  puntos: PuntoBanda[]
}

/**
 * Parte la banda entre dos series en tramos de un solo signo, cortando en el
 * cruce exacto. Sin el corte, un tramo que pasa de arriba a abajo se pintaría
 * entero del color equivocado.
 */
export function tramosBanda(
  x: number[],
  a: (number | undefined)[],
  b: (number | undefined)[],
): TramoBanda[] {
  const tramos: TramoBanda[] = []
  let abierto: TramoBanda | undefined

  const agregar = (signo: 1 | -1, punto: PuntoBanda) => {
    if (!abierto || abierto.signo !== signo) {
      abierto = { signo, puntos: [] }
      tramos.push(abierto)
    }
    abierto.puntos.push(punto)
  }

  for (let i = 0; i < x.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai == null || bi == null) {
      abierto = undefined
      continue
    }
    agregar(ai >= bi ? 1 : -1, { x: x[i], a: ai, b: bi })

    const an = a[i + 1]
    const bn = b[i + 1]
    if (an == null || bn == null) continue
    if (ai >= bi === an >= bn) continue

    const t = (ai - bi) / (ai - bi - (an - bn))
    const cruce = { x: x[i] + t * (x[i + 1] - x[i]), a: bi + t * (bn - bi), b: bi + t * (bn - bi) }
    agregar(ai >= bi ? 1 : -1, cruce)
    agregar(an >= bn ? 1 : -1, cruce)
  }

  return tramos.filter((t) => t.puntos.length > 1)
}

/** Índices repartidos para etiquetar un eje sin amontonar texto. */
export function indicesEtiqueta(total: number, maximo = 5): number[] {
  if (total <= 0) return []
  if (total <= maximo) return Array.from({ length: total }, (_, i) => i)
  const paso = (total - 1) / (maximo - 1)
  return Array.from({ length: maximo }, (_, i) => Math.round(i * paso))
}

/**
 * Rellena los huecos interiores en línea recta. La banda se pinta contra la
 * misma geometría que dibuja la línea, que ya une los puntos sueltos; sin esto
 * un pesaje cada cinco días dejaría la banda partida en nada.
 */
export function interpolar(x: number[], datos: (number | undefined)[]): (number | undefined)[] {
  const salida = [...datos]
  let previo = -1
  for (let i = 0; i < datos.length; i++) {
    if (datos[i] == null) continue
    if (previo >= 0 && i - previo > 1) {
      const paso = (datos[i]! - datos[previo]!) / (x[i] - x[previo])
      for (let j = previo + 1; j < i; j++) salida[j] = datos[previo]! + paso * (x[j] - x[previo])
    }
    previo = i
  }
  return salida
}

/**
 * La referencia necesita aire a los dos lados: pegada al borde no se lee que
 * hay un arriba y un abajo, que es justo lo que la gráfica quiere decir.
 */
export function dominioConReferencia(valores: number[], referencia: number): [number, number] {
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const lado = Math.max(max - referencia, referencia - min)
  return [Math.min(min, referencia - lado * 0.22), Math.max(max, referencia + lado * 0.22)]
}
