import type { Aplicacion, EntregaSocio, Gasto, Ingreso, Lote, Pesaje, Registro } from '../db/schema'
import { cobradoDe, pendienteDe } from './cobros'
import { diasEntre } from './format'
import { categoriaLabel, RAZA, tipoIngresoLabel } from './labels'
import type { LoteMetrics } from './metrics'
import { analizarMuestra } from './muestreo'
import { retiroDe } from './retiro'
import { nombreSocio } from './sociedad'
import { LB_POR_QUINTAL } from './standards'
import type { Celda, Hoja } from './xlsx'

export interface DatosDelCiclo {
  lote: Lote
  registros: Registro[]
  pesajes: Pesaje[]
  gastos: Gasto[]
  ingresos: Ingreso[]
  aplicaciones: Aplicacion[]
  entregas: EntregaSocio[]
  metrics: LoteMetrics
}

const TIPO_APLICACION = { vacuna: 'Vacuna', medicina: 'Medicina', vitamina: 'Vitamina' } as const
const fecha = (f?: string): Celda => (f ? { fecha: f } : undefined)
const redondo = (v: number | undefined, dec = 2) => (v == null ? undefined : Math.round(v * 10 ** dec) / 10 ** dec)

// El ciclo en hojas de cálculo: un resumen y cada cosa anotada en su hoja, para
// sacar las cuentas a mano, mandárselas al contador o guardarlas aparte.
export function hojasDelCiclo(d: DatosDelCiclo, granja: string): Hoja[] {
  const { lote, metrics: m } = d
  const porFecha = <T extends { fecha: string }>(xs: T[]) => [...xs].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const quien = (i: number | undefined) =>
    i != null && lote.socios?.[i] ? nombreSocio(lote.socios[i], i) : lote.socios?.length ? 'Común' : undefined

  const resumen: Celda[][] = [
    [lote.nombre, ''],
    ['Granja', lote.compartido?.de ?? granja],
    ['Raza', RAZA],
    ['Llegaron los pollitos', fecha(lote.fechaInicio)],
    ...(lote.fechaCierre ? [['Cierre', fecha(lote.fechaCierre)] as Celda[]] : []),
    ['Día del ciclo', m.dias],
    ['Pollitos recibidos', lote.cantidadInicial],
    ['Bajas y descartes', m.bajas],
    ['Mortalidad (%)', redondo(m.mortalidadPct)],
    ['Aves vendidas', m.vendidas],
    ['Aves en el galpón', m.avesVivas],
    ['Peso promedio (lb)', redondo(m.pesoFinalLb ?? m.pesoEstimadoLb)],
    ['Alimento (lb)', redondo(m.alimentoTotalLb, 1)],
    ['Alimento (qq)', redondo(m.alimentoTotalLb / LB_POR_QUINTAL, 1)],
    ['Conversión (FCA)', redondo(m.fca)],
    ['Costos', redondo(m.costos)],
    ['Ventas', redondo(m.ingresos)],
    // Con el ciclo en curso, lo vendido es solo una parte: no es una pérdida.
    lote.estado === 'cerrado'
      ? ['Ganancia', redondo(m.ganancia)]
      : m.ingresos > 0
        ? ['Vendido menos invertido', redondo(m.ganancia)]
        : ['Invertido', redondo(m.costos)],
    ['Costo por libra', redondo(m.costoPorLb)],
    ...(m.porCobrar > 0 ? [['Por cobrar', redondo(m.porCobrar)] as Celda[]] : []),
    ...(lote.socios && lote.socios.length >= 2
      ? [['Socios', lote.socios.map((s, i) => `${nombreSocio(s, i)} ${s.pct} %`).join(' · ')] as Celda[]]
      : []),
  ]

  const dias: Celda[][] = [
    ['Fecha', 'Día', 'Bajas', 'Descarte', 'Alimento (lb)', 'Agua (L)', 'Peso (lb)', 'Temp. máx. (°C)', 'Humedad (%)', 'Nota'],
    ...porFecha(d.registros).map((r) => [
      fecha(r.fecha),
      diasEntre(lote.fechaInicio, r.fecha),
      r.mortalidad,
      r.descarte,
      r.alimentoLb || undefined,
      r.aguaL,
      r.pesoPromedio,
      r.tempMaxC,
      r.humedadPct,
      r.soloPeso ? 'Solo pesaje' : r.nota,
    ]),
  ]

  const gastos: Celda[][] = [
    ['Fecha', 'Categoría', 'Detalle', 'Quintales', 'Monto', ...(lote.socios?.length ? ['Pagó'] : [])],
    ...(lote.costoInicial > 0
      ? [[fecha(lote.fechaInicio), 'Pollitos', `${lote.cantidadInicial} pollitos`, undefined, lote.costoInicial, ...(lote.socios?.length ? [quien(lote.costoInicialPagadoPor)] : [])]]
      : []),
    ...porFecha(d.gastos).map((g) => [
      fecha(g.fecha),
      categoriaLabel(g.categoria),
      g.descripcion,
      g.cantidadQq,
      g.monto,
      ...(lote.socios?.length ? [quien(g.pagadoPor)] : []),
    ]),
  ]

  const ventas: Celda[][] = [
    ['Fecha', 'Comprador', 'Tipo', 'Aves', 'Libras', 'Monto', 'Cobrado', 'Falta'],
    ...porFecha(d.ingresos).map((i) => [
      fecha(i.fecha),
      i.comprador ?? i.descripcion,
      tipoIngresoLabel(i.tipo),
      i.cantidad || undefined,
      i.pesoLb,
      i.monto,
      redondo(cobradoDe(i)),
      redondo(pendienteDe(i)) || undefined,
    ]),
  ]

  const pesajes: Celda[][] = [
    ['Fecha', 'Día', 'Aves pesadas', 'Promedio (lb)', 'Más liviana', 'Más pesada', 'CV (%)', 'Uniformidad (%)'],
    ...porFecha(d.pesajes).flatMap((p) => {
      const s = analizarMuestra(p.pesos)
      return s
        ? [[fecha(p.fecha), diasEntre(lote.fechaInicio, p.fecha), s.n, redondo(s.promedioLb), s.minLb, s.maxLb, redondo(s.cvPct, 1), redondo(s.uniformidadPct, 1)]]
        : []
    }),
  ]

  const sanidad: Celda[][] = [
    ['Fecha', 'Día', 'Tipo', 'Nombre', 'Vía', 'Dosis', 'Días que se da', 'Retiro (días)', 'Se vende desde'],
    ...porFecha(d.aplicaciones).map((a) => [
      fecha(a.fecha),
      diasEntre(lote.fechaInicio, a.fecha),
      TIPO_APLICACION[a.tipo],
      a.nombre,
      a.via,
      a.dosis,
      a.diasTratamiento,
      a.retiroDias,
      fecha(retiroDe(a)?.libreDesde),
    ]),
  ]

  const hojas: Hoja[] = [
    { nombre: 'Resumen', filas: resumen },
    { nombre: 'Días', filas: dias },
    { nombre: 'Gastos', filas: gastos },
    { nombre: 'Ventas', filas: ventas },
    { nombre: 'Pesajes', filas: pesajes },
    { nombre: 'Sanidad', filas: sanidad },
  ]
  if (d.entregas.length && lote.socios?.length) {
    hojas.push({
      nombre: 'Entregas',
      filas: [
        ['Fecha', 'De', 'A', 'Monto', 'Nota'],
        ...porFecha(d.entregas).map((e) => [fecha(e.fecha), quien(e.de), quien(e.a), e.monto, e.nota]),
      ],
    })
  }
  return hojas
}

export interface SemanaDelCiclo {
  semana: number
  bajas: number
  pctLote: number
  alimentoLb: number
  /** El último peso anotado en la semana. */
  pesoLb?: number
}

// Semana a semana, para el reporte impreso: un ciclo de 40 días en una tabla
// de seis filas que se lee de un vistazo.
export function semanasDelCiclo(lote: Pick<Lote, 'fechaInicio' | 'cantidadInicial'>, registros: Registro[]): SemanaDelCiclo[] {
  const semanas = new Map<number, SemanaDelCiclo>()
  for (const r of [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const n = Math.floor(Math.max(0, diasEntre(lote.fechaInicio, r.fecha) - 1) / 7) + 1
    const s = semanas.get(n) ?? { semana: n, bajas: 0, pctLote: 0, alimentoLb: 0 }
    s.bajas += (r.mortalidad ?? 0) + (r.descarte ?? 0)
    s.alimentoLb += r.alimentoLb ?? 0
    if (r.pesoPromedio != null) s.pesoLb = r.pesoPromedio
    semanas.set(n, s)
  }
  return [...semanas.values()]
    .map((s) => ({ ...s, pctLote: lote.cantidadInicial > 0 ? (s.bajas / lote.cantidadInicial) * 100 : 0 }))
    .sort((a, b) => a.semana - b.semana)
}
