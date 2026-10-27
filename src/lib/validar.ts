import { num, plural } from './format'

// Lo que entra de un archivo —un respaldo, o un ciclo que mandó un socio— se
// revisa fila por fila antes de tocar la base. Un archivo editado a mano,
// cortado a la mitad o de otra app no puede dejar ciclos sin fecha, montos que
// no son números o dos filas con el mismo número, que hacían fallar la
// restauración a medias o, peor, entraban y rompían las cuentas después.

export type Tabla =
  | 'lotes'
  | 'registros'
  | 'gastos'
  | 'ingresos'
  | 'pesajes'
  | 'aplicaciones'
  | 'deudas'
  | 'abonos'
  | 'entregas'

type Fila = Record<string, unknown>

export const esObjeto = (v: unknown): v is Fila => typeof v === 'object' && v !== null && !Array.isArray(v)
const esFecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const esNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const esNumOpc = (v: unknown) => v == null || esNum(v)
const esTexto = (v: unknown) => typeof v === 'string'
const esTextoOpc = (v: unknown) => v == null || esTexto(v)
const esId = (v: unknown) => esNum(v) && Number.isInteger(v)
const esIdOpc = (v: unknown) => v == null || esId(v)
// Lo que va dentro de una fila también se revisa: un cobro con el monto como
// texto pasaba, y los montos se juntaban como letras («050003000»), dando la
// venta por pagada.
const listaDe = (v: unknown, cada: (f: Fila) => boolean) =>
  v == null || (Array.isArray(v) && v.every((x) => esObjeto(x) && cada(x)))
const esSocio = (s: Fila) => esTexto(s.nombre) && esNumOpc(s.pct)
const esCobro = (c: Fila) => esFecha(c.fecha) && esNum(c.monto) && esIdOpc(c.recibidoPor)
const esConteo = (c: Fila) => esFecha(c.fecha) && esNum(c.qq)
const esMovimiento = (m: Fila) => esFecha(m.fecha) && esTexto(m.de) && esTexto(m.a) && esNum(m.aves)
const esPorVenir = (g: Fila) => esTexto(g.concepto) && esNum(g.monto) && esTextoOpc(g.categoria)
const CADA_PAGO = ['dia', 'semana', 'quincena', 'mes', 'ciclo', 'ave']
const esEmpleados = (v: unknown) =>
  v == null || (esObjeto(v) && esNum(v.monto) && CADA_PAGO.includes(v.cada as string))
const esArreglado = (v: unknown) => v == null || (esObjeto(v) && esNum(v.rindePct))

const FASES_ALIMENTO_ID = ['preinicio', 'iniciador', 'crecimiento', 'engorde']
const esFaseOpc = (v: unknown) => v == null || FASES_ALIMENTO_ID.includes(v as string)

const REVISAR: Record<Tabla, (f: Fila) => boolean> = {
  lotes: (l) =>
    esTexto(l.nombre) &&
    esFecha(l.fechaInicio) &&
    esNum(l.cantidadInicial) &&
    esNumOpc(l.costoInicial) &&
    (l.estado === 'activo' || l.estado === 'cerrado') &&
    listaDe(l.socios, esSocio) &&
    listaDe(l.conteosAlimento, esConteo) &&
    listaDe(l.movimientos, esMovimiento) &&
    esEmpleados(l.empleados) &&
    esNumOpc(l.diaVenta) &&
    listaDe(l.gastosPorVenir, esPorVenir) &&
    (l.cierre == null || esObjeto(l.cierre)),
  registros: (r) =>
    esId(r.loteId) &&
    esFecha(r.fecha) &&
    esNumOpc(r.mortalidad) &&
    esNumOpc(r.descarte) &&
    esNumOpc(r.alimentoLb) &&
    esTextoOpc(r.causa) &&
    esFaseOpc(r.alimentoFase),
  gastos: (g) =>
    esIdOpc(g.loteId) &&
    esFecha(g.fecha) &&
    esNum(g.monto) &&
    esFaseOpc(g.fase) &&
    (g.traspaso == null || (esObjeto(g.traspaso) && esId(g.traspaso.loteId) && esIdOpc(g.traspaso.gastoId))),
  ingresos: (i) =>
    esIdOpc(i.loteId) &&
    esFecha(i.fecha) &&
    esNum(i.monto) &&
    listaDe(i.cobros, esCobro) &&
    esTextoOpc(i.galponId) &&
    esNumOpc(i.precioLb) &&
    esArreglado(i.arreglado),
  pesajes: (p) => esId(p.loteId) && esFecha(p.fecha) && Array.isArray(p.pesos) && p.pesos.every(esNum),
  aplicaciones: (a) => esId(a.loteId) && esFecha(a.fecha) && esTexto(a.nombre),
  deudas: (d) => esTexto(d.concepto) && esNum(d.monto) && esFecha(d.fecha) && listaDe(d.socios, esSocio),
  abonos: (a) => esId(a.deudaId) && esFecha(a.fecha) && esNum(a.monto),
  entregas: (e) => esId(e.loteId) && esFecha(e.fecha) && esId(e.de) && esId(e.a) && esNum(e.monto),
}

// Con su género, para que la frase concuerde: «1 venta viene incompleta».
const NOMBRES: Record<Tabla, [string, string, 'm' | 'f']> = {
  lotes: ['ciclo', 'ciclos', 'm'],
  registros: ['día anotado', 'días anotados', 'm'],
  gastos: ['gasto', 'gastos', 'm'],
  ingresos: ['venta', 'ventas', 'f'],
  pesajes: ['pesaje', 'pesajes', 'm'],
  aplicaciones: ['vacuna o medicina', 'vacunas y medicinas', 'f'],
  deudas: ['deuda', 'deudas', 'f'],
  abonos: ['abono', 'abonos', 'm'],
  entregas: ['entrega entre socios', 'entregas entre socios', 'f'],
}

const cuantos = (n: number, tabla: Tabla) => `${num(n)} ${plural(n, NOMBRES[tabla][0], NOMBRES[tabla][1])}`
const dañado = (n: number, tabla: Tabla) => {
  const f = NOMBRES[tabla][2] === 'f'
  return n === 1
    ? `viene ${f ? 'incompleta o dañada' : 'incompleto o dañado'}`
    : `vienen ${f ? 'incompletas o dañadas' : 'incompletos o dañados'}`
}

/**
 * Revisa una lista del archivo. Devuelve qué está mal, en palabras del
 * productor, o nada si se puede guardar. Con `conId`, cada fila trae su número
 * y no se puede repetir: así se guardan en la base.
 */
export function revisarFilas(tabla: Tabla, filas: unknown, { conId = true } = {}): string | undefined {
  if (!Array.isArray(filas)) return `la lista de ${NOMBRES[tabla][1]} no se puede leer`
  const malas = filas.filter((f) => !esObjeto(f) || (conId && !esId(f.id)) || !REVISAR[tabla](f)).length
  if (malas) return `${cuantos(malas, tabla)} ${dañado(malas, tabla)}`
  if (conId) {
    const ids = new Set<unknown>()
    let repetidas = 0
    for (const f of filas as Fila[]) {
      if (ids.has(f.id)) repetidas++
      ids.add(f.id)
    }
    if (repetidas)
      return `${cuantos(repetidas, tabla)} ${repetidas === 1 ? 'repite' : 'repiten'} el número de otro`
  }
  return undefined
}

/** El texto de la primera lista con problemas, o nada. */
export function primerProblema(listas: [Tabla, unknown][], opciones?: { conId?: boolean }): string | undefined {
  for (const [tabla, filas] of listas) {
    const p = revisarFilas(tabla, filas, opciones)
    if (p) return p
  }
  return undefined
}
