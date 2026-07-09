import Dexie, { type EntityTable } from 'dexie'

export type TipoLote = 'engorde' | 'ponedora'
export type EstadoLote = 'activo' | 'cerrado'

export interface Lote {
  id: number
  tipo: TipoLote
  nombre: string
  fechaInicio: string
  cantidadInicial: number
  costoInicial: number
  estado: EstadoLote
  edadInicialSemanas?: number
  pesoObjetivoLb?: number
  fechaCierre?: string
  notas?: string
  creado: number
}

export interface Registro {
  id: number
  loteId: number
  fecha: string
  mortalidad: number
  descarte: number
  alimentoLb: number
  pesoPromedio?: number
  huevos?: number
  huevosRotos?: number
  nota?: string
  creado: number
}

export type CategoriaGasto =
  | 'alimento'
  | 'aves'
  | 'medicina'
  | 'mano_obra'
  | 'transporte'
  | 'equipo'
  | 'otros'

export interface Gasto {
  id: number
  loteId?: number
  categoria: CategoriaGasto
  monto: number
  fecha: string
  descripcion?: string
  creado: number
}

export type TipoIngreso = 'aves' | 'huevos' | 'otros'

export interface Ingreso {
  id: number
  loteId?: number
  tipo: TipoIngreso
  cantidad: number
  pesoLb?: number
  monto: number
  fecha: string
  descripcion?: string
  creado: number
}

export const db = new Dexie('avicontrol') as Dexie & {
  lotes: EntityTable<Lote, 'id'>
  registros: EntityTable<Registro, 'id'>
  gastos: EntityTable<Gasto, 'id'>
  ingresos: EntityTable<Ingreso, 'id'>
}

db.version(1).stores({
  lotes: '++id, tipo, estado, fechaInicio',
  registros: '++id, loteId, fecha',
  gastos: '++id, loteId, categoria, fecha',
  ingresos: '++id, loteId, tipo, fecha',
})
