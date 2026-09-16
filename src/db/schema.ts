import Dexie, { type EntityTable } from 'dexie'

export type TipoLote = 'engorde'
export type EstadoLote = 'activo' | 'cerrado'

export interface Socio {
  nombre: string
  pct: number
}

// Lo que la app proyectaba justo antes de vender, congelado al cerrar: después
// de registrar la venta ya no hay forma de reconstruirlo, y sin esto no se puede
// contrastar lo que dijo la app contra lo que pasó.
export interface CierreCiclo {
  diaVenta: number
  pesoProyectadoLb?: number
  diaProyectado?: number
  avesProyectadas?: number
  lbProyectadas?: number
  precioEquilibrioLb?: number
  gananciaProyectada?: number
}

export interface Lote {
  id: number
  tipo: TipoLote
  nombre: string
  fechaInicio: string
  cantidadInicial: number
  costoInicial: number
  estado: EstadoLote
  pesoObjetivoLb?: number
  precioVentaLb?: number
  precioQuintal?: number
  socios?: Socio[]
  costoInicialPagadoPor?: number
  fechaCierre?: string
  cierre?: CierreCiclo
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
  aguaL?: number
  pesoPromedio?: number
  nota?: string
  creado: number
}

export interface Pesaje {
  id: number
  loteId: number
  fecha: string
  pesos: number[]
  creado: number
}

export type TipoAplicacion = 'vacuna' | 'medicina' | 'vitamina'

export interface Aplicacion {
  id: number
  loteId: number
  fecha: string
  tipo: TipoAplicacion
  nombre: string
  via?: string
  dosis?: string
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
  cantidadQq?: number
  pagadoPor?: number
  creado: number
}

export type TipoIngreso = 'aves' | 'otros'

export interface Ingreso {
  id: number
  loteId?: number
  tipo: TipoIngreso
  cantidad: number
  pesoLb?: number
  monto: number
  fecha: string
  descripcion?: string
  recibidoPor?: number
  creado: number
}

export type CategoriaDeuda = 'estructura' | 'equipo' | 'terreno' | 'otros'

// Lo que se debe por la granja en sí —el galpón, el equipo, el terreno— y no
// por un ciclo. No se salda de un golpe con una crianza: se va abonando, así
// que vive fuera del resultado del ciclo para no ensuciar la comparación entre
// crianzas.
export interface Deuda {
  id: number
  concepto: string
  categoria: CategoriaDeuda
  monto: number
  fecha: string
  acreedor?: string
  socios?: Socio[]
  notas?: string
  creado: number
}

export interface Abono {
  id: number
  deudaId: number
  fecha: string
  monto: number
  pagadoPor?: number
  nota?: string
  creado: number
}

export const db = new Dexie('avicontrol') as Dexie & {
  lotes: EntityTable<Lote, 'id'>
  registros: EntityTable<Registro, 'id'>
  gastos: EntityTable<Gasto, 'id'>
  ingresos: EntityTable<Ingreso, 'id'>
  pesajes: EntityTable<Pesaje, 'id'>
  aplicaciones: EntityTable<Aplicacion, 'id'>
  deudas: EntityTable<Deuda, 'id'>
  abonos: EntityTable<Abono, 'id'>
}

db.version(1).stores({
  lotes: '++id, tipo, estado, fechaInicio',
  registros: '++id, loteId, fecha',
  gastos: '++id, loteId, categoria, fecha',
  ingresos: '++id, loteId, tipo, fecha',
})

db.version(2).stores({
  pesajes: '++id, loteId, fecha',
})

db.version(3).stores({
  aplicaciones: '++id, loteId, fecha',
})

db.version(4).stores({
  deudas: '++id, fecha',
  abonos: '++id, deudaId, fecha',
})
