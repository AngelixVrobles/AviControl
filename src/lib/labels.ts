import type { CategoriaGasto, TipoIngreso, TipoLote } from '../db/schema'

export const RAZA = 'Cobb 500'

export const CATEGORIAS: { id: CategoriaGasto; label: string }[] = [
  { id: 'alimento', label: 'Alimento' },
  { id: 'aves', label: 'Compra de aves' },
  { id: 'medicina', label: 'Medicina / vacunas' },
  { id: 'mano_obra', label: 'Mano de obra' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'otros', label: 'Otros' },
]

export const categoriaLabel = (id: string) =>
  CATEGORIAS.find((c) => c.id === id)?.label ?? id

export const TIPOS_INGRESO: { id: TipoIngreso; label: string }[] = [
  { id: 'aves', label: 'Venta de aves' },
  { id: 'otros', label: 'Otros ingresos' },
]

export const tipoIngresoLabel = (id: string) =>
  TIPOS_INGRESO.find((t) => t.id === id)?.label ?? id

export const tipoLoteLabel = (_t: TipoLote) => 'Pollos de engorde'

// Rampa de un solo tono (forest-deep → green-action → green-on-dark → green-pale
// → line). Bajo sol los dos últimos escalones no se distinguen: el orden y el
// monto son el canal real, la barra solo acompaña.
export const CHART_RAMP = ['#153F27', '#1E7340', '#4FA968', '#B9DCC3', '#DCD6C7']
export const CHART_INK = '#3A4840'
export const CHART_LINE = '#DCD6C7'
export const CHART_RAISED = '#FFFEFA'
