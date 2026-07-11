import type { Raza } from '../db/schema'

// Peso vivo as-hatched (lb) por día. Ross 308 y Cobb 500, objetivos de rendimiento
// de las líneas comerciales convertidos a libras.
const PESO_LB: Record<Raza, [number, number][]> = {
  ross308: [
    [0, 0.09],
    [7, 0.45],
    [14, 1.19],
    [21, 2.26],
    [28, 3.56],
    [35, 4.97],
    [42, 6.4],
    [49, 7.73],
    [56, 8.93],
  ],
  cobb500: [
    [0, 0.09],
    [7, 0.42],
    [14, 1.14],
    [21, 2.2],
    [28, 3.53],
    [35, 4.9],
    [42, 6.35],
    [49, 7.65],
    [56, 8.85],
  ],
}

// Consumo de alimento acumulado (lb/ave) por día.
const ALIM_ACUM_LB: Record<Raza, [number, number][]> = {
  ross308: [
    [0, 0],
    [7, 0.36],
    [14, 1.17],
    [21, 2.51],
    [28, 4.39],
    [35, 6.75],
    [42, 9.5],
    [49, 12.52],
    [56, 15.72],
  ],
  cobb500: [
    [0, 0],
    [7, 0.35],
    [14, 1.14],
    [21, 2.46],
    [28, 4.32],
    [35, 6.66],
    [42, 9.4],
    [49, 12.4],
    [56, 15.55],
  ],
}

const POSTURA_PCT: [number, number][] = [
  [18, 10],
  [19, 35],
  [20, 60],
  [21, 80],
  [22, 90],
  [24, 95],
  [30, 96],
  [40, 94],
  [50, 91],
  [60, 87],
  [70, 82],
  [80, 76],
  [90, 70],
]

const TEMP_C: [number, number][] = [
  [1, 33],
  [7, 31],
  [14, 29],
  [21, 27],
  [28, 24],
  [35, 22],
  [42, 20],
]

function interpolar(tabla: [number, number][], x: number): number {
  if (x <= tabla[0][0]) return tabla[0][1]
  const last = tabla[tabla.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < tabla.length; i++) {
    const [x1, y1] = tabla[i - 1]
    const [x2, y2] = tabla[i]
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)
  }
  return last[1]
}

export const pesoEstandarLb = (dia: number, raza: Raza = 'ross308') =>
  interpolar(PESO_LB[raza], dia)

export const alimentoAcumEstandarLb = (dia: number, raza: Raza = 'ross308') =>
  interpolar(ALIM_ACUM_LB[raza], dia)

export const alimentoDiaEstandarLb = (dia: number, raza: Raza = 'ross308') =>
  Math.max(0, alimentoAcumEstandarLb(dia, raza) - alimentoAcumEstandarLb(dia - 1, raza))

export const posturaEstandarPct = (semanaEdad: number) => interpolar(POSTURA_PCT, semanaEdad)

export const tempRecomendadaC = (dia: number) => Math.round(interpolar(TEMP_C, Math.max(1, dia)))

export const mortalidadEsperadaPct = (dia: number) => Math.min(5, dia * 0.09)

// Día en que la curva alcanza el peso objetivo (para dimensionar el ciclo).
export function diaParaPeso(objetivoLb: number, raza: Raza = 'ross308'): number {
  for (let d = 1; d <= 63; d++) if (pesoEstandarLb(d, raza) >= objetivoLb) return d
  return 63
}

export const AVES_POR_M2 = 11
export const LB_POR_QUINTAL = 100

export const FASES_ENGORDE = [
  { nombre: 'Pre-iniciador', desde: 0, hasta: 10 },
  { nombre: 'Iniciador', desde: 11, hasta: 21 },
  { nombre: 'Finalizador', desde: 22, hasta: Infinity },
] as const

export const EDAD_INICIAL_DEFAULT = 18
export const RAZA_DEFAULT: Raza = 'ross308'
