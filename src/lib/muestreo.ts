// Muestreo de peso: pesar unas cuantas aves y saber qué tan confiable es ese
// promedio para todo el galpón. La precisión sale del intervalo de confianza al
// 95 % con corrección por población finita — con pocas aves el margen es grande,
// y eso es justo lo que hay que ver antes de decidir una venta.

const T_95: Record<number, number> = {
  1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262,
  10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101,
  19: 2.093, 20: 2.086, 21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052,
  28: 2.048, 29: 2.045, 30: 2.042,
}

const Z_95 = 1.96

const t95 = (gl: number) => T_95[gl] ?? (gl >= 60 ? Z_95 : 2.0)

export const CV_TIPICO_PCT = 10
export const PRECISION_OBJETIVO_PCT = 3
const UNIFORMIDAD_BANDA_PCT = 10

export interface Muestra {
  n: number
  promedioLb: number
  minLb: number
  maxLb: number
  desvEstLb: number
  cvPct: number
  uniformidadPct: number
  pctLote: number
  margenLb: number
  margenPct: number
  precision: 'alta' | 'media' | 'baja'
  uniformidad: 'excelente' | 'buena' | 'regular' | 'despareja'
  biomasaLb?: number
  biomasaMinLb?: number
  biomasaMaxLb?: number
}

export function analizarMuestra(pesos: number[], avesVivas = 0): Muestra | null {
  const xs = pesos.filter((p) => p > 0)
  if (xs.length === 0) return null

  const n = xs.length
  const promedioLb = xs.reduce((a, b) => a + b, 0) / n
  const varianza = n > 1 ? xs.reduce((a, b) => a + (b - promedioLb) ** 2, 0) / (n - 1) : 0
  const desvEstLb = Math.sqrt(varianza)
  const cvPct = promedioLb > 0 ? (desvEstLb / promedioLb) * 100 : 0

  const dentro = xs.filter((p) => Math.abs(p - promedioLb) / promedioLb <= UNIFORMIDAD_BANDA_PCT / 100)
  const uniformidadPct = (dentro.length / n) * 100

  // Corrección por población finita: pesar 20 de 100 aves informa mucho más que
  // pesar 20 de 5000. Sin población conocida se calcula sin corregir.
  const N = Math.max(avesVivas, n)
  const fpc = avesVivas <= 0 ? 1 : N > n ? Math.sqrt((N - n) / (N - 1)) : 0
  const margenLb = n > 1 ? (t95(n - 1) * desvEstLb) / Math.sqrt(n) * fpc : 0
  const margenPct = promedioLb > 0 ? (margenLb / promedioLb) * 100 : 0

  return {
    n,
    promedioLb,
    minLb: Math.min(...xs),
    maxLb: Math.max(...xs),
    desvEstLb,
    cvPct,
    uniformidadPct,
    pctLote: avesVivas > 0 ? (n / avesVivas) * 100 : 0,
    margenLb,
    margenPct,
    precision: n < 2 ? 'baja' : margenPct <= 2 ? 'alta' : margenPct <= 5 ? 'media' : 'baja',
    uniformidad: cvPct < 8 ? 'excelente' : cvPct < 10 ? 'buena' : cvPct < 12 ? 'regular' : 'despareja',
    biomasaLb: avesVivas > 0 ? avesVivas * promedioLb : undefined,
    biomasaMinLb: avesVivas > 0 ? avesVivas * (promedioLb - margenLb) : undefined,
    biomasaMaxLb: avesVivas > 0 ? avesVivas * (promedioLb + margenLb) : undefined,
  }
}

// Aves a pesar para que el promedio quede dentro de ±precisión, con el desparejo
// (CV) que tenga el lote. Reproduce la regla de campo de «1–2 % del galpón».
export function tamanoMuestra(
  avesVivas: number,
  cvPct = CV_TIPICO_PCT,
  precisionPct = PRECISION_OBJETIVO_PCT,
): number {
  if (avesVivas <= 0 || precisionPct <= 0) return 0
  const cv = Math.max(4, cvPct)
  const n0 = (Z_95 * cv) ** 2 / precisionPct ** 2
  const n = n0 / (1 + n0 / avesVivas)
  return Math.max(5, Math.min(avesVivas, Math.ceil(n)))
}

// Cuántas aves más faltan por pesar en la muestra que ya se está tomando.
export function faltanPorPesar(
  m: Muestra,
  avesVivas: number,
  precisionPct = PRECISION_OBJETIVO_PCT,
): number {
  // Con una sola ave el margen sale 0 y no significa nada: hasta que no haya
  // dispersión medible se pide la muestra del CV típico.
  if (m.n < 2) return Math.max(0, tamanoMuestra(avesVivas, CV_TIPICO_PCT, precisionPct) - m.n)
  if (m.margenPct <= precisionPct) return 0
  return Math.max(0, tamanoMuestra(avesVivas, m.cvPct, precisionPct) - m.n)
}
