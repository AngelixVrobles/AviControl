import type { CierreCiclo, Ingreso, Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import type { Proyeccion } from './proyeccion'
import { diasEntre } from './format'

// Lo que la app proyectaba para todo el ciclo justo antes de la última venta.
// Las ventas de antes ya salieron: se suman a las aves y libras proyectadas, y
// el precio mínimo es el que mostraba la pantalla, descontado lo ya vendido.
// Antes, con una venta parcial, «Cómo salió» marcaba 154 % más aves vendidas
// de las proyectadas y un precio mínimo que la app nunca dijo.
export function snapshotCierre(m: LoteMetrics, p: Proyeccion | null, diaVenta: number): CierreCiclo {
  return {
    diaVenta,
    pesoProyectadoLb: p?.pesoVentaLb ?? m.pesoEstimadoLb,
    diaProyectado: p?.diaVenta ?? m.diaVentaEstimado,
    avesProyectadas: (p?.avesAlVender ?? m.avesVivas) + m.vendidas,
    lbProyectadas: p ? p.lbEnPie + Math.round(m.lbVendidas) : undefined,
    precioEquilibrioLb:
      p && p.lbEnPie > 0 ? Math.max(0, p.costoProyectado - m.ingresos) / p.lbEnPie : undefined,
    gananciaProyectada: p?.gananciaProyectada,
  }
}

// Las libras de las ventas: las pesadas, como salieron en la báscula; las que
// se vendieron por cabeza, al peso promedio de las pesadas o, si ninguna se
// pesó, al del lote. El peso por ave y el precio logrado salen solo de las
// pesadas: mezclar aves sin peso daba un pollo de 2.8 lb que pesaba 5.5.
export function librasVendidas(ventas: Ingreso[], pesoDelLote?: number) {
  const pesadas = ventas.filter((i) => (i.pesoLb ?? 0) > 0 && i.cantidad > 0)
  const avesPesadas = pesadas.reduce((a, i) => a + i.cantidad, 0)
  const lbPesadas = pesadas.reduce((a, i) => a + i.pesoLb!, 0)
  const montoPesadas = pesadas.reduce((a, i) => a + i.monto, 0)
  const pesoPromedioLb = avesPesadas > 0 ? lbPesadas / avesPesadas : undefined
  const avesSinPesar = ventas
    .filter((i) => !((i.pesoLb ?? 0) > 0) && i.cantidad > 0)
    .reduce((a, i) => a + i.cantidad, 0)
  const pesoSinPesar = pesoPromedioLb ?? pesoDelLote ?? 0
  return {
    lbTotal: lbPesadas + avesSinPesar * pesoSinPesar,
    pesoPromedioLb,
    precioLogradoLb: lbPesadas > 0 ? montoPesadas / lbPesadas : undefined,
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
  const lb = librasVendidas(ventas, m.pesoEstimadoLb)
  const ingreso = ventas.reduce((a, i) => a + i.monto, 0)

  const real: RealCiclo = {
    diaVenta: lote.cierre?.diaVenta ?? diasEntre(lote.fechaInicio, ventas[ventas.length - 1].fecha),
    avesVendidas,
    lbVendidas: Math.round(lb.lbTotal),
    pesoPromedioLb: lb.pesoPromedioLb,
    precioLogradoLb: lb.precioLogradoLb,
    ingreso,
    ganancia: m.ganancia,
    margenPct: m.margenPct,
    costoPorLb: lb.lbTotal > 0 ? m.costos / lb.lbTotal : undefined,
    gananciaPorAve: avesVendidas > 0 ? m.ganancia / avesVendidas : 0,
  }

  return { ...real, contrastes: construirContrastes(lote.cierre, real) }
}
