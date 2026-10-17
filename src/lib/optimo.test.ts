import { describe, expect, it } from 'vitest'
import { analizarPuntoOptimo } from './optimo'
import { computeMetrics } from './metrics'
import { proyectarVenta } from './proyeccion'
import { gasto, hace, lote, registro } from '../test/fixtures'

const l = lote({ precioVentaLb: 60 })
const registros = [registro(30, { pesoPromedio: 4, alimentoLb: 4000 })]
const justo = [gasto({ id: 1, categoria: 'alimento', monto: 76000, cantidadQq: 40 })]
const adelanto = [...justo, gasto({ id: 2, categoria: 'alimento', monto: 38000, cantidadQq: 20 })]

const analizar = (gastos: typeof justo) => {
  const m = computeMetrics(l, registros, gastos, [])
  return { a: analizarPuntoOptimo(l, registros, gastos, m)!, m, gastos }
}

describe('analizarPuntoOptimo', () => {
  it('busca el día en que la ganancia deja de subir', () => {
    const { a } = analizar(justo)
    expect(a.puntos.length).toBeGreaterThan(1)
    for (const p of a.puntos) expect(p.ganancia).toBeLessThanOrEqual(a.optimo.ganancia)
  })

  // Comer lo del almacén hoy o guardarlo para el próximo ciclo vale lo mismo:
  // comprar por adelantado no puede mover el mejor día ni la libra marginal.
  it('comprar alimento por adelantado no mueve el mejor día', () => {
    const sin = analizar(justo).a
    const con = analizar(adelanto).a
    expect(con.optimo.dia).toBe(sin.optimo.dia)
    expect(con.gananciaExtra).toBeCloseTo(sin.gananciaExtra, 5)
    con.puntos.forEach((p, i) => expect(p.costoLbMarginal).toBeCloseTo(sin.puntos[i].costoLbMarginal, 5))
  })

  // Lo que se compró de más ya está en los costos: el día de venta la cuenta
  // tiene que dar lo mismo que la proyección, sin cobrar los sacos dos veces.
  it('el día de venta cuesta lo mismo que dice la proyección', () => {
    const { a, m, gastos } = analizar(adelanto)
    const p = proyectarVenta(l, registros, gastos, m, 5.5)!
    const diaVenta = a.puntos.find((x) => x.dia === p.diaVenta)!
    expect(diaVenta.costo).toBeCloseTo(p.costoProyectado, -2)
  })
})

describe('ciclos que se pasan del día 56', () => {
  // La venta atrasada: antes el recorrido quedaba vacío y la pestaña Dinero se
  // caía con «La app se quedó trabada».
  it('no se cae y dice que hoy es el día', () => {
    const viejo = lote({ precioVentaLb: 60, fechaInicio: hace(60) })
    const regs = [{ ...registro(30, { pesoPromedio: 4, alimentoLb: 4000 }), fecha: hace(30) }]
    const m = computeMetrics(viejo, regs, justo, [])
    const a = analizarPuntoOptimo(viejo, regs, justo, m)
    expect(a).not.toBeNull()
    expect(a!.puntos).toHaveLength(1)
    expect(a!.optimo.dia).toBe(60)
    expect(Number.isFinite(a!.hoy.ganancia)).toBe(true)
  })
})
