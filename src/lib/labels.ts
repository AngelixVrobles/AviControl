import type { CategoriaGasto, CausaBaja, TipoIngreso, TipoLote } from '../db/schema'

export const RAZA = 'Cobb 500'

export const CATEGORIAS: { id: CategoriaGasto; label: string }[] = [
  { id: 'alimento', label: 'Alimento' },
  { id: 'aves', label: 'Compra de aves' },
  { id: 'medicina', label: 'Medicina / vacunas' },
  // La cama y el gas de las criadoras son de los gastos grandes de cada ciclo:
  // en «Otros» no se veía cuánto se iba en ellos.
  { id: 'cama', label: 'Cama (cascarilla, viruta)' },
  { id: 'energia', label: 'Gas y luz' },
  { id: 'mano_obra', label: 'Mano de obra' },
  // Lo de arreglar el pollo que se vende limpio: el gas para pelarlo, las
  // fundas, el hielo. Aparte de la mano de obra, que es la de los empleados.
  { id: 'arreglo', label: 'Arreglo del pollo (gas, fundas, hielo)' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'otros', label: 'Otros' },
]

export const categoriaLabel = (id: string) =>
  CATEGORIAS.find((c) => c.id === id)?.label ?? id

export const CAUSAS_BAJA: { id: CausaBaja; label: string; corto: string }[] = [
  { id: 'calor', label: 'Calor', corto: 'Calor' },
  { id: 'amontonadas', label: 'Amontonadas o aplastadas', corto: 'Amontonadas' },
  { id: 'enfermedad', label: 'Enfermedad', corto: 'Enfermedad' },
  { id: 'subita', label: 'Muerte súbita', corto: 'Súbita' },
  { id: 'ascitis', label: 'Ascitis (barriga con agua)', corto: 'Ascitis' },
  { id: 'otra', label: 'Otra cosa', corto: 'Otra' },
]

export const causaLabel = (id?: string) => CAUSAS_BAJA.find((c) => c.id === id)?.label

export const TIPOS_INGRESO: { id: TipoIngreso; label: string }[] = [
  { id: 'aves', label: 'Venta de aves' },
  { id: 'otros', label: 'Otros ingresos' },
]

export const tipoIngresoLabel = (id: string) =>
  TIPOS_INGRESO.find((t) => t.id === id)?.label ?? id

export const tipoLoteLabel = (_t: TipoLote) => 'Pollos de engorde'


// Lo que distingue un ciclo de otro debajo de una barra angosta: «Pollada de
// agosto» y «Lote de julio» quedan en «agosto» y «julio». Si aun así no cabe
// alguno, `undefined`, y va la fecha.
export function nombresCortos(nombres: string[], max = 10): string[] | undefined {
  const cortos = nombres.map((n) =>
    n
      .trim()
      .replace(/^(lote|ciclo|pollada|pollos|crianza)\s+(de(l)?\s+)?/i, '')
      .trim(),
  )
  const palabras = cortos.map((n) => n.split(/\s+/))
  // Lo que se repite al principio de todos tampoco distingue nada.
  let k = 0
  while (
    palabras.length > 1 &&
    palabras.every((p) => p.length > k + 1 && p[k].toLowerCase() === palabras[0][k].toLowerCase())
  )
    k++
  const finales = palabras.map((p) => p.slice(k).join(' '))
  return finales.every((n) => n.length > 0 && n.length <= max) ? finales : undefined
}
