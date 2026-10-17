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

