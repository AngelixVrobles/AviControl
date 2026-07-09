import type { CategoriaGasto, TipoIngreso, TipoLote } from '../db/schema'

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
  { id: 'huevos', label: 'Venta de huevos' },
  { id: 'otros', label: 'Otros ingresos' },
]

export const tipoIngresoLabel = (id: string) =>
  TIPOS_INGRESO.find((t) => t.id === id)?.label ?? id

export const tipoLoteLabel = (t: TipoLote) =>
  t === 'engorde' ? 'Pollos de engorde' : 'Gallinas ponedoras'

export const CHART_COLORS = ['#2F8A4C', '#E9A93C', '#C4622D', '#4FA968', '#5C6A61', '#256F3D', '#B4711A']
