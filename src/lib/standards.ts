// Cobb500 Broiler Performance Objectives (Imperial, as-hatched), suplemento 2022.
// El índice del arreglo es el día de edad. El consumo de los días 1–6 no aparece
// en la tabla oficial: se repartió la acumulación hasta el día 7 siguiendo la
// rampa de consumo diario publicada.
const PESO_LB = [
  0.09, 0.12, 0.16, 0.2, 0.25, 0.3, 0.37, 0.45, 0.53, 0.62, 0.73, 0.84, 0.97, 1.11, 1.26, 1.41,
  1.57, 1.73, 1.9, 2.08, 2.27, 2.46, 2.66, 2.86, 3.06, 3.28, 3.49, 3.71, 3.93, 4.16, 4.38, 4.62,
  4.85, 5.08, 5.32, 5.56, 5.8, 6.04, 6.27, 6.51, 6.75, 6.99, 7.23, 7.46, 7.69, 7.93, 8.15, 8.38,
  8.6, 8.82, 9.04, 9.25, 9.46, 9.66, 9.85, 10.05, 10.23,
]

const ALIM_ACUM_LB = [
  0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.32, 0.4, 0.49, 0.59, 0.7, 0.83, 0.97, 1.13, 1.31, 1.5, 1.7,
  1.92, 2.15, 2.39, 2.65, 2.93, 3.22, 3.52, 3.84, 4.17, 4.51, 4.86, 5.22, 5.59, 5.97, 6.36, 6.76,
  7.17, 7.59, 8.02, 8.46, 8.91, 9.36, 9.82, 10.29, 10.77, 11.26, 11.75, 12.25, 12.76, 13.28, 13.81,
  14.35, 14.89, 15.44, 16.0, 16.56, 17.13, 17.7, 18.28, 18.86,
]

const DIA_MAX = PESO_LB.length - 1

const acotar = (dia: number) => Math.max(0, Math.min(DIA_MAX, Math.round(dia)))

export const pesoEstandarLb = (dia: number) => PESO_LB[acotar(dia)]

export const alimentoAcumEstandarLb = (dia: number) => ALIM_ACUM_LB[acotar(dia)]

export const alimentoDiaEstandarLb = (dia: number) =>
  Math.max(0, alimentoAcumEstandarLb(dia) - alimentoAcumEstandarLb(dia - 1))

export const fcaEstandar = (dia: number) => alimentoAcumEstandarLb(dia) / pesoEstandarLb(dia)

const TEMP_C: [number, number][] = [
  [1, 33],
  [7, 31],
  [14, 29],
  [21, 27],
  [28, 24],
  [35, 22],
  [42, 20],
]

export function tempRecomendadaC(dia: number): number {
  const d = Math.max(1, dia)
  if (d >= 42) return 20
  for (let i = 1; i < TEMP_C.length; i++) {
    const [x1, y1] = TEMP_C[i - 1]
    const [x2, y2] = TEMP_C[i]
    if (d <= x2) return Math.round(y1 + ((d - x1) / (x2 - x1)) * (y2 - y1))
  }
  return 20
}

export const mortalidadEsperadaPct = (dia: number) => Math.min(5, dia * 0.09)

// Densidad por biomasa: 30 kg/m² es el techo razonable en galpón abierto de clima
// cálido, más conservador que los 33–39 kg/m² de galpón con ventilación forzada.
export const KG_POR_M2 = 30
export const LB_POR_QUINTAL = 100
export const KG_POR_LB = 0.453592

export const avesPorM2 = (pesoLb: number) => KG_POR_M2 / Math.max(0.1, pesoLb * KG_POR_LB)

// Día en que la curva alcanza el peso objetivo. `factor` escala la curva al
// rendimiento real del lote (peso real / peso estándar del mismo día).
export function diaParaPeso(objetivoLb: number, factor = 1): number {
  for (let d = 1; d <= DIA_MAX; d++) if (pesoEstandarLb(d) * factor >= objetivoLb) return d
  return DIA_MAX
}

export interface FaseAlimento {
  nombre: string
  desde: number
  hasta: number
  proteinaPct: string
  kcalKg: number
  presentacion: string
}

// Las cuatro fases que se venden en República Dominicana, ajustadas a los cortes
// de Cobb (starter 0–12, grower 13–28, grower 2 29–39, finalizador 40+) para un
// pollo de mercado de 5–6 lb.
export const FASES_ALIMENTO: FaseAlimento[] = [
  { nombre: 'Pre-inicio', desde: 0, hasta: 10, proteinaPct: '22–23', kcalKg: 2900, presentacion: 'Migaja fina' },
  { nombre: 'Iniciador', desde: 11, hasta: 24, proteinaPct: '20–21', kcalKg: 2950, presentacion: 'Migaja' },
  { nombre: 'Crecimiento', desde: 25, hasta: 35, proteinaPct: '19', kcalKg: 3050, presentacion: 'Pellet' },
  { nombre: 'Engorde', desde: 36, hasta: Infinity, proteinaPct: '18', kcalKg: 3100, presentacion: 'Pellet' },
]

export const PESO_OBJETIVO_DEFAULT = 5.5
export const DIAS_RETIRO = 5

export interface Hito {
  dia: number
  etiqueta: string
  tipo: 'recibo' | 'sanitario' | 'alimento' | 'venta'
}

export function hitosEngorde(diaObjetivo: number): Hito[] {
  const hitos: Hito[] = [
    { dia: 1, etiqueta: 'Recibo', tipo: 'recibo' },
    { dia: 7, etiqueta: 'Newcastle', tipo: 'sanitario' },
    { dia: 11, etiqueta: 'Iniciador', tipo: 'alimento' },
    { dia: 14, etiqueta: 'Gumboro', tipo: 'sanitario' },
    { dia: 21, etiqueta: 'Refuerzo', tipo: 'sanitario' },
    { dia: 25, etiqueta: 'Crecimiento', tipo: 'alimento' },
    { dia: 36, etiqueta: 'Engorde', tipo: 'alimento' },
    { dia: diaObjetivo - DIAS_RETIRO, etiqueta: 'Retiro', tipo: 'sanitario' },
    { dia: diaObjetivo, etiqueta: 'Venta', tipo: 'venta' },
  ]
  return hitos.filter((h) => h.dia > 0 && h.dia <= diaObjetivo).sort((a, b) => a.dia - b.dia)
}
