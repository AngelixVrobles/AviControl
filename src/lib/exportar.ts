import type { Aplicacion, EntregaSocio, Gasto, Ingreso, Lote, Pesaje, Registro } from '../db/schema'
import { cobradoDe, pendienteDe } from './cobros'
import { diasEntre } from './format'
import { categoriaLabel, causaLabel, RAZA, tipoIngresoLabel } from './labels'
import type { LoteMetrics } from './metrics'
import { analizarMuestra } from './muestreo'
import { retiroDe } from './retiro'
import { galponInicial, nombreDeGalpon } from './galpones'
import { avesPorGalpon, repartido } from './reparto'
import type { Galpon } from './settings'
import { nombreSocio } from './sociedad'
import { LB_POR_QUINTAL } from './standards'
import { precioDe } from './venta'
import { alimentoPorTipo, faseDeCompra, nombreFase } from './alimentos'
import type { FaseId } from './standards'
import type { Celda, Hoja } from './xlsx'
import { resumenPesada } from './pesada'

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
export function hojasDelCiclo(d: DatosDelCiclo, granja: string, galpones: Galpon[] = []): Hoja[] {
  const { lote, metrics: m } = d
  // El alimento de cada día, el que se compró: «Engorde», no la fase del estándar.
  const porTipo = alimentoPorTipo(lote, d.registros, d.gastos, m)
  const tipoDelDia = (dia: number) => {
    const f = porTipo.dias.find((x) => x.dia === dia)?.fase
    return f ? nombreFase(f) : undefined
  }
  const nombreDeTipo = (f?: FaseId) => (f ? nombreFase(f) : undefined)
  // Con la pollada repartida, los galpones van en su hoja y cada venta dice de
  // cuál salió. Los nombres son los de esta granja.
  const enVarios = repartido(lote) && !lote.compartido
  const granjaGalpones = { galpones }
  const galpon = (id?: string) => (id ? nombreDeGalpon(id, granjaGalpones) : 'De todos')
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
    ...(lote.incubadora ? [['Incubadora', lote.incubadora] as Celda[]] : []),
    ...(lote.pesoLlegadaG ? [['Peso al llegar (g)', lote.pesoLlegadaG] as Celda[]] : []),
    ...(lote.muertosLlegada ? [['Llegaron muertos', lote.muertosLlegada] as Celda[]] : []),
    ['Bajas y descartes', m.bajas],
    ['Mortalidad (%)', redondo(m.mortalidadPct)],
    ['Aves vendidas', m.vendidas],
    ['Aves en el galpón', m.avesVivas],
    ['Peso promedio (lb)', redondo(m.pesoFinalLb ?? m.pesoEstimadoLb)],
    ['Alimento (lb)', redondo(m.alimentoTotalLb, 1)],
    ['Alimento (qq)', redondo(m.alimentoTotalLb / LB_POR_QUINTAL, 1)],
    ['Conversión (FCA)', redondo(m.fca)],
    [lote.estado === 'cerrado' ? 'Costos' : 'Invertido hasta hoy', redondo(m.costos)],
    [lote.estado === 'cerrado' ? 'Ventas' : 'Vendido hasta hoy', redondo(m.ingresos)],
    // Con el ciclo en curso, lo vendido es solo una parte: no es una pérdida.
    ...(lote.estado === 'cerrado' ? [['Ganancia', redondo(m.ganancia)] as Celda[]] : []),
    ['Costo por libra', redondo(m.costoPorLb)],
    ...(m.porCobrar > 0 ? [['Por cobrar', redondo(m.porCobrar)] as Celda[]] : []),
    ...(lote.socios && lote.socios.length >= 2
      ? [['Socios', lote.socios.map((s, i) => `${nombreSocio(s, i)} ${s.pct}%`).join(' · ')] as Celda[]]
      : []),
  ]

  const dias: Celda[][] = [
    ['Fecha', 'Día', 'Bajas', 'Causa', 'Descarte', 'Alimento (lb)', 'Tipo de alimento', 'Agua (L)', 'Peso (lb)', 'Temp. máx. (°C)', 'Humedad (%)', 'Nota'],
    ...porFecha(d.registros).map((r) => [
      fecha(r.fecha),
      diasEntre(lote.fechaInicio, r.fecha),
      r.mortalidad,
      causaLabel(r.causa),
      r.descarte,
      r.alimentoLb || undefined,
      r.alimentoLb ? tipoDelDia(diasEntre(lote.fechaInicio, r.fecha)) : undefined,
      r.aguaL,
      r.pesoPromedio,
      r.tempMaxC,
      r.humedadPct,
      r.soloPeso ? 'Solo pesaje' : r.nota,
    ]),
  ]

  const gastos: Celda[][] = [
    ['Fecha', 'Categoría', 'Detalle', 'Tipo de alimento', 'Quintales', 'Monto', ...(lote.socios?.length ? ['Pagó'] : [])],
    ...(lote.costoInicial > 0
      ? [[fecha(lote.fechaInicio), 'Pollitos', `${lote.cantidadInicial} pollitos`, undefined, undefined, lote.costoInicial, ...(lote.socios?.length ? [quien(lote.costoInicialPagadoPor)] : [])]]
      : []),
    ...porFecha(d.gastos).map((g) => [
      fecha(g.fecha),
      categoriaLabel(g.categoria),
      g.descripcion,
      g.categoria === 'alimento' ? nombreDeTipo(faseDeCompra(g)) : undefined,
      g.cantidadQq,
      g.monto,
      ...(lote.socios?.length ? [quien(g.pagadoPor)] : []),
    ]),
  ]

  const ventas: Celda[][] = [
    [
      'Fecha',
      'Comprador',
      'Tipo',
      'Cómo salió',
      'Aves',
      'Libras',
      'Precio por libra',
      'Monto',
      'Cobrado',
      'Falta',
      'Cajas',
      'Cajas vacías (lb)',
      'Cajas con pollo (lb)',
      ...(enVarios ? ['Galpón'] : []),
    ],
    ...porFecha(d.ingresos).map((i) => [
      fecha(i.fecha),
      i.comprador ?? i.descripcion,
      tipoIngresoLabel(i.tipo),
      i.tipo === 'aves' ? (i.arreglado ? 'Arreglado' : 'En pie') : undefined,
      i.cantidad || undefined,
      i.pesoLb,
      precioDe(i),
      i.monto,
      redondo(cobradoDe(i)),
      redondo(pendienteDe(i)) || undefined,
      // La pesada por cajas, para cuadrar con el cuaderno.
      ...(i.pesada
        ? ((r) => [r.cajas || undefined, r.tara, r.bruto])(resumenPesada(i.pesada))
        : [undefined, undefined, undefined]),
      ...(enVarios ? [i.tipo === 'aves' ? galpon(i.galponId) : undefined] : []),
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
  if (enVarios) {
    // Con el ciclo en curso, debajo, lo que hay hoy en cada galpón.
    const hoy =
      lote.estado === 'activo'
        ? avesPorGalpon(lote, galponInicial(lote, granjaGalpones), d.registros, d.ingresos, '9999-12-31')
        : []
    hojas.push({
      nombre: 'Galpones',
      filas: [
        ['Fecha', 'Día', 'Salen de', 'Van a', 'Aves'],
        ...porFecha(lote.movimientos ?? []).map((mv) => [
          fecha(mv.fecha),
          diasEntre(lote.fechaInicio, mv.fecha),
          galpon(mv.de),
          galpon(mv.a),
          mv.aves,
        ]),
        ...(hoy.length ? [[], ['Hoy en cada galpón', 'Aves'], ...hoy.map((c) => [galpon(c.galponId), c.aves])] : []),
      ],
    })
  }
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
