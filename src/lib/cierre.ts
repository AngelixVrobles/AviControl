import type { CierreCiclo, Ingreso, Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import type { Proyeccion } from './proyeccion'
import { diasEntre } from './format'

export function snapshotCierre(m: LoteMetrics, p: Proyeccion | null, diaVenta: number): CierreCiclo {
  return {
    diaVenta,
    pesoProyectadoLb: p?.pesoVentaLb ?? m.pesoEstimadoLb,
    diaProyectado: p?.diaVenta ?? m.diaVentaEstimado,
    avesProyectadas: p?.avesAlVender ?? m.avesVivas,
    lbProyectadas: p?.lbEnPie,
    precioEquilibrioLb: p?.precioEquilibrioLb,
    gananciaProyectada: p?.gananciaProyectada,
  }
}

export interface Contraste {
  etiqueta: string
  proyectado: number
  real: number
  formato: 'peso' | 'precio' | 'dinero' | 'entero'
  mejorSi?: 'mayor' | 'menor'
}

export interface RealCiclo {
  diaVenta: number
  avesVendidas: number
  lbVendidas: number
  pesoPromedioLb?: number
  precioLogradoLb?: number
  ingreso: number
  ganancia: number
  margenPct: number
  costoPorLb?: number
  gananciaPorAve: number
}

export function construirContrastes(c: CierreCiclo | undefined, r: RealCiclo): Contraste[] {
  const out: Contraste[] = []
  const agregar = (
    etiqueta: string,
    proyectado: number | undefined,
    real: number | undefined,
    formato: Contraste['formato'],
    mejorSi?: Contraste['mejorSi'],
  ) => {
    if (proyectado == null || real == null) return
    out.push({ etiqueta, proyectado, real, formato, mejorSi })
  }

  agregar('Peso por ave', c?.pesoProyectadoLb, r.pesoPromedioLb, 'peso', 'mayor')
  agregar('Día de venta', c?.diaProyectado, r.diaVenta, 'entero')
  agregar('Aves vendidas', c?.avesProyectadas, r.avesVendidas, 'entero', 'mayor')
  agregar('Libras vendidas', c?.lbProyectadas, r.lbVendidas, 'entero', 'mayor')
  agregar('Precio por libra', c?.precioEquilibrioLb, r.precioLogradoLb, 'precio', 'mayor')
  agregar('Ganancia', c?.gananciaProyectada, r.ganancia, 'dinero', 'mayor')
  return out
}

export function resultadoCiclo(
  lote: Lote,
  m: LoteMetrics,
  ingresos: Ingreso[],
): (RealCiclo & { contrastes: Contraste[] }) | null {
  const ventas = ingresos.filter((i) => i.tipo === 'aves')
  if (!ventas.length) return null

  const avesVendidas = ventas.reduce((a, i) => a + i.cantidad, 0)
  const lbVendidas = ventas.reduce((a, i) => a + (i.pesoLb ?? 0), 0)
  const ingreso = ventas.reduce((a, i) => a + i.monto, 0)

  const real: RealCiclo = {
    diaVenta: lote.cierre?.diaVenta ?? diasEntre(lote.fechaInicio, ventas[ventas.length - 1].fecha),
    avesVendidas,
    lbVendidas,
    pesoPromedioLb: avesVendidas > 0 && lbVendidas > 0 ? lbVendidas / avesVendidas : undefined,
    precioLogradoLb: lbVendidas > 0 ? ingreso / lbVendidas : undefined,
    ingreso,
    ganancia: m.ganancia,
    margenPct: m.margenPct,
    costoPorLb: lbVendidas > 0 ? m.costos / lbVendidas : undefined,
    gananciaPorAve: avesVendidas > 0 ? m.ganancia / avesVendidas : 0,
  }

  return { ...real, contrastes: construirContrastes(lote.cierre, real) }
}
