import Dexie, { type EntityTable } from 'dexie'
import type { FaseId } from '../lib/standards'

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
  // El precio de equilibrio era por libra arreglada: solo se compara con lo que
  // se cobró por libra arreglada.
  arreglado?: boolean
}

// Sacos contados en el almacén en una fecha. Con las compras anotadas en
// quintales, lo que falta es lo que se dio: así se saca el consumo sin pesar el
// alimento cada día, que es como lo lleva la mayoría.
export interface ConteoAlimento {
  fecha: string
  qq: number
}

// Aves que se pasan de un galpón a otro sin dejar el ciclo: llegaron 1,000
// pollitos a un galpón de 8.6 × 8.6 m, crecieron, ya no cabían y 350 se pasaron
// a otro. Sigue siendo la misma pollada, con sus mismas cuentas.
export interface MovimientoAves {
  fecha: string
  /** El galpón de donde salen y al que van: el id de Ajustes. */
  de: string
  a: string
  aves: number
}

// Lo que se les paga a los empleados del ciclo, para estimar lo que falta: por
// día, semana, quincena o mes; una suma por toda la pollada; o tanto por pollo.
export type CadaPago = 'dia' | 'semana' | 'quincena' | 'mes' | 'ciclo' | 'ave'

export interface PagoEmpleados {
  monto: number
  cada: CadaPago
}

// Un gasto que ya se sabe que viene antes de vender —la luz, el camión, las
// fundas—: entra en la ganancia estimada hasta que se paga y pasa a los gastos.
export interface GastoPorVenir {
  concepto: string
  monto: number
  categoria: CategoriaGasto
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
  // El día en que se piensa vender. Sin él, se vende cuando lleguen al peso de
  // venta; con él, la proyección, el alimento que falta y el pago de los
  // empleados van hasta ese día.
  diaVenta?: number
  precioVentaLb?: number
  precioQuintal?: number
  socios?: Socio[]
  costoInicialPagadoPor?: number
  fechaCierre?: string
  cierre?: CierreCiclo
  conteosAlimento?: ConteoAlimento[]
  // En qué galpón de la granja está; sin él, el primero. Si la pollada se
  // reparte, es donde llegaron los pollitos, y `movimientos` dice el resto.
  galponId?: string
  movimientos?: MovimientoAves[]
  // Lo que falta por pagar además del alimento, para la ganancia estimada.
  empleados?: PagoEmpleados
  gastosPorVenir?: GastoPorVenir[]
  // El recibo: de qué incubadora vinieron, lo que pesaban al llegar (en gramos,
  // como se pesa el pollito) y cuántos llegaron muertos en las cajas. Los que
  // llegaron muertos están en `cantidadInicial` pero nunca entraron al galpón.
  incubadora?: string
  pesoLlegadaG?: number
  muertosLlegada?: number
  // Un ciclo que mandó un socio desde su teléfono: se mira, no se toca, y no
  // entra en las cuentas de esta granja. Se pone al día cuando lo manda otra vez.
  compartido?: { de: string; exportado: string; origen: string }
  notas?: string
  creado: number
}

// De qué murió la mayoría ese día. Al final del ciclo dice de qué se muere el
// lote: no es lo mismo perder 60 por calor que por enfermedad.
export type CausaBaja = 'calor' | 'amontonadas' | 'enfermedad' | 'subita' | 'ascitis' | 'otra'

export interface Registro {
  id: number
  loteId: number
  fecha: string
  mortalidad: number
  descarte: number
  alimentoLb: number
  aguaL?: number
  // La máxima del día dentro del galpón, y la humedad si hay higrómetro: con el
  // pollo grande el calor de la tarde es lo que más mata de golpe.
  tempMaxC?: number
  humedadPct?: number
  pesoPromedio?: number
  causa?: CausaBaja
  /**
   * El alimento que se dio ese día, si el productor lo cambió. Sin él, es el
   * que toca por los sacos comprados: se acaba uno y sigue el próximo.
   */
  alimentoFase?: FaseId
  nota?: string
  // Lo creó un pesaje en un día sin registro: trae el peso y nada más. No cuenta
  // como el registro del día —faltan las bajas y el alimento— hasta que se
  // completa en la hoja del día, que le quita la marca.
  soloPeso?: boolean
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
  // Una medicina se da varios días seguidos, y después hay que esperar su
  // retiro para vender: lo que diga el frasco.
  diasTratamiento?: number
  retiroDias?: number
  nota?: string
  creado: number
}

export type CategoriaGasto =
  | 'alimento'
  | 'aves'
  | 'medicina'
  | 'cama'
  | 'energia'
  | 'mano_obra'
  | 'arreglo'
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
  /**
   * El tipo de alimento de la compra. Sin él, sale del nombre («Mega Broiler
   * Crecimiento» es crecimiento).
   */
  fase?: FaseId
  pagadoPor?: number
  // Alimento que sobró y se pasó de un ciclo a otro: el gasto va en los dos,
  // en negativo en el que lo pasó, y cada uno apunta al otro.
  traspaso?: { loteId: number; gastoId?: number }
  creado: number
}

export type TipoIngreso = 'aves' | 'otros'

// Un pago de una venta a crédito: el comprador se lleva el pollo y paga
// después, en una o varias veces.
export interface Cobro {
  fecha: string
  monto: number
  recibidoPor?: number
  nota?: string
}

export interface Ingreso {
  id: number
  loteId?: number
  tipo: TipoIngreso
  cantidad: number
  pesoLb?: number
  // El precio por libra que se le puso. El total se redondea a pesos, y de él
  // no siempre sale el precio exacto: a 65, se volvía 65.04 al corregirla.
  precioLb?: number
  // Lo que vale la venta. Si es a crédito, lo que el comprador debe en total.
  monto: number
  fecha: string
  descripcion?: string
  recibidoPor?: number
  comprador?: string
  // A crédito el dinero entra con los cobros; si no, se cobró completo el día
  // de la venta.
  credito?: boolean
  cobros?: Cobro[]
  // Con la pollada en varios galpones, de cuál salieron las aves vendidas.
  // Sin él, la venta se reparte entre los galpones según las aves de cada uno.
  galponId?: string
  // Pollo vendido arreglado —matado y limpio—: `pesoLb` son libras arregladas,
  // y `rindePct` lo que quedó arreglado de cada 100 lb en pie. Con eso se saca
  // el peso en pie que salió del galpón, que es el que cuentan la conversión y
  // el peso por ave.
  arreglado?: { rindePct: number }
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

// Dinero que un socio le da a otro para dejar la cuenta pareja: no es gasto ni
// venta del ciclo —la ganancia no cambia—, solo mueve quién tiene qué. Sin
// anotarlo, la liquidación seguía pidiendo el mismo pago después de hecho.
export interface EntregaSocio {
  id: number
  loteId: number
  fecha: string
  de: number
  a: number
  monto: number
  nota?: string
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

// Lo que había en el teléfono antes de restaurar un respaldo. Si era el
// respaldo equivocado, se vuelve a esto desde Ajustes: antes restaurar no tenía
// vuelta atrás.
export interface CopiaAntes {
  id: number
  creado: number
  json: string
  resumen: string
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
  entregas: EntityTable<EntregaSocio, 'id'>
  copias: EntityTable<CopiaAntes, 'id'>
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

db.version(5).stores({
  entregas: '++id, loteId, fecha',
})

db.version(6).stores({
  copias: '++id, creado',
})
