import type { Ingreso, Lote, Registro } from '../db/schema'
import { diasEntre, hoyISO, num, sumarDias } from './format'
import { tempRecomendadaC } from './standards'

// Desde esta edad el pollo ya no necesita calor: produce el suyo, y el que
// sobra lo mata. En galpón abierto, con el pollo grande, el calor de la tarde
// es lo que más mortalidad da de golpe.
export const EDAD_CALOR = 21
export const CALOR_C = 30
export const PELIGRO_C = 34
// La regla del galpón para el calor con humedad: grados Fahrenheit más el % de
// humedad. El aire húmedo no deja que el ave se enfríe jadeando, y 30 °C con
// 80 % de humedad pesan más que 33 °C en un día seco.
export const CALOR_INDICE = 160
export const PELIGRO_INDICE = 170

export type NivelCalor = 'peligro' | 'calor' | 'frio' | 'bien'

export interface JuicioCalor {
  nivel: NivelCalor
  dia: number
  tempC: number
  humedad?: number
  /** Lo que el pollito necesita a esa edad. */
  recomendadaC: number
  /** °F + % de humedad, si se anotó la humedad. */
  indice?: number
}

const aF = (c: number) => (c * 9) / 5 + 32

export function juicioCalor(tempC: number, dia: number, humedad?: number): JuicioCalor {
  const recomendadaC = tempRecomendadaC(dia)
  const indice = humedad != null && humedad > 0 ? Math.round(aF(tempC) + humedad) : undefined
  const base = { dia, tempC, humedad: indice != null ? humedad : undefined, recomendadaC, indice }
  if (dia >= EDAD_CALOR) {
    if (tempC >= PELIGRO_C || (indice ?? 0) >= PELIGRO_INDICE) return { ...base, nivel: 'peligro' }
    if (tempC >= CALOR_C || (indice ?? 0) >= CALOR_INDICE) return { ...base, nivel: 'calor' }
    return { ...base, nivel: 'bien' }
  }
  // El pollito necesita calor, pero no tanto: lo que se pasa de lo que pide su
  // edad lo hace jadear igual. Y si la máxima del día no llega a lo que pide,
  // pasó frío todo el día.
  if (tempC >= recomendadaC + 7) return { ...base, nivel: 'peligro' }
  if (tempC >= recomendadaC + 4) return { ...base, nivel: 'calor' }
  if (dia <= 14 && tempC < recomendadaC - 3) return { ...base, nivel: 'frio' }
  return { ...base, nivel: 'bien' }
}

export const conCalor = (j?: JuicioCalor) => j?.nivel === 'calor' || j?.nivel === 'peligro'

export const gradosCalor = (j: Pick<JuicioCalor, 'tempC' | 'humedad'>) =>
  `${num(j.tempC)} °C${j.humedad != null ? ` con ${num(j.humedad)}% de humedad` : ''}`

// Qué quiere decir esa temperatura a esa edad y qué hacer: debajo de la casilla
// al anotarla, y en el aviso del ciclo.
export function fraseCalor(j: JuicioCalor): string {
  const pide = `unos ${num(j.recomendadaC)} °C`
  switch (j.nivel) {
    case 'peligro':
      return j.dia >= EDAD_CALOR
        ? 'Calor que mata al pollo grande: abre cortinas, pon los ventiladores, agua fresca, y no les des comida en las horas de calor.'
        : `Demasiado para pollitos de ${j.dia} días, que piden ${pide}: abre cortinas y apaga o sube las criadoras.`
    case 'calor':
      return j.dia >= EDAD_CALOR
        ? 'El pollo grande ya jadea: ventila, agua fresca a la sombra, y corre la comida a las horas frescas.'
        : `Más de lo que piden a los ${j.dia} días (${pide}): ventila y revisa las criadoras.`
    case 'frio':
      return `A los ${j.dia} días piden ${pide}: pasan frío. Revisa las criadoras y cierra cortinas.`
    default:
      return j.dia >= EDAD_CALOR
        ? `Bien: el pollo grande está cómodo por debajo de ${CALOR_C} °C.`
        : `Bien para los ${j.dia} días, que piden ${pide}.`
  }
}

export const juicioDe = (lote: Pick<Lote, 'fechaInicio'>, r: Registro): JuicioCalor | undefined =>
  r.tempMaxC != null && r.tempMaxC > 0
    ? juicioCalor(r.tempMaxC, diasEntre(lote.fechaInicio, r.fecha), r.humedadPct)
    : undefined

// El calor que todavía importa: el de hoy o el de ayer. El de la semana pasada
// ya pasó y no tiene por qué seguir avisando.
export function calorReciente(
  lote: Pick<Lote, 'fechaInicio'>,
  registros: Registro[],
  hoy = hoyISO(),
): JuicioCalor | undefined {
  const ayer = sumarDias(hoy, -1)
  const ultimo = [...registros]
    .filter((r) => r.tempMaxC != null && r.tempMaxC > 0 && r.fecha <= hoy && r.fecha >= ayer)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return ultimo ? juicioDe(lote, ultimo) : undefined
}

export interface CalorDelCiclo {
  /** Días con temperatura anotada. */
  anotados: number
  diasCalor: number
  /** Bajas por cada mil aves en un día de calor y en uno normal. */
  porMilCalor?: number
  porMilNormal?: number
  /** El día más caliente. */
  peor?: { fecha: string; dia: number; tempC: number; bajas: number }
}

// Lo que murió los días de calor contra los demás, por cada mil aves que había
// esa mañana. La primera semana se deja fuera: lo que muere ahí viene del
// pollito y del recibo.
export function calorDelCiclo(
  lote: Pick<Lote, 'fechaInicio' | 'cantidadInicial' | 'muertosLlegada'>,
  registros: Registro[],
  ingresos: Ingreso[] = [],
): CalorDelCiclo | null {
  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ventas = ingresos.filter((i) => i.tipo === 'aves')
  // Las aves de cada mañana restan lo vendido los días antes: vendidas 700 de
  // 1,000, las bajas de un día de calor se dividían entre las 1,000.
  const vendidasAntes = (f: string) => ventas.filter((i) => i.fecha < f).reduce((a, i) => a + i.cantidad, 0)
  let vivas = lote.cantidadInicial - (lote.muertosLlegada ?? 0)
  const calor = { dias: 0, bajas: 0, aves: 0 }
  const normal = { dias: 0, bajas: 0, aves: 0 }
  let anotados = 0
  let diasCalor = 0
  let peor: CalorDelCiclo['peor']
  for (const r of ordenados) {
    const bajas = (r.mortalidad ?? 0) + (r.descarte ?? 0)
    const j = juicioDe(lote, r)
    if (j) {
      anotados++
      if (conCalor(j)) diasCalor++
      if (!peor || j.tempC > peor.tempC) peor = { fecha: r.fecha, dia: j.dia, tempC: j.tempC, bajas }
      const enGalpon = vivas - vendidasAntes(r.fecha)
      if (j.dia > 7 && enGalpon > 0) {
        const grupo = conCalor(j) ? calor : normal
        grupo.dias++
        grupo.bajas += bajas
        grupo.aves += enGalpon
      }
    }
    vivas -= bajas
  }
  if (!anotados) return null
  const porMil = (g: typeof calor) => (g.dias > 0 && g.aves > 0 ? (g.bajas / g.aves) * 1000 : undefined)
  return { anotados, diasCalor, porMilCalor: porMil(calor), porMilNormal: porMil(normal), peor }
}
