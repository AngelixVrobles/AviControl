import { describe, expect, it } from 'vitest'
import { computeLiquidacion } from './sociedad'
import { computeMetrics } from './metrics'
import { gasto, ingreso, lote, registro } from '../test/fixtures'

const socios = [
  { nombre: 'Ana', pct: 50 },
  { nombre: 'Beto', pct: 50 },
]

function liquidar(l = lote({ socios }), gastos = [] as ReturnType<typeof gasto>[], ingresos = [] as ReturnType<typeof ingreso>[]) {
  const m = computeMetrics(l, [registro(1)], gastos, ingresos)
  return { liq: computeLiquidacion(l, gastos, ingresos, m)!, m }
}

describe('computeLiquidacion', () => {
  it('no aplica sin al menos dos socios', () => {
    const m = computeMetrics(lote(), [], [], [])
    expect(computeLiquidacion(lote(), [], [], m)).toBeNull()
    expect(computeLiquidacion(lote({ socios: [{ nombre: 'Solo', pct: 100 }] }), [], [], m)).toBeNull()
  })

  it('reparte lo común según el porcentaje de cada uno', () => {
    const { liq } = liquidar(lote({ socios, costoInicial: 20000 }))
    expect(liq.socios.map((s) => s.aporte)).toEqual([10000, 10000])
  })

  it('carga el gasto entero a quien lo pagó', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 30000, pagadoPor: 0 })],
    )
    expect(liq.socios[0].aporte).toBe(30000)
    expect(liq.socios[1].aporte).toBe(0)
  })

  it('normaliza porcentajes que no suman cien', () => {
    const { liq } = liquidar(
      lote({ socios: [{ nombre: 'Ana', pct: 30 }, { nombre: 'Beto', pct: 10 }], costoInicial: 4000 }),
    )
    expect(liq.socios[0].pct).toBeCloseTo(75, 5)
    expect(liq.socios[0].aporte).toBe(3000)
  })

  // Lo que cada uno se lleva menos lo que puso tiene que dar la ganancia total:
  // si esto no cuadra, alguien sale perdiendo sin saberlo.
  it('los ajustes reparten la ganancia completa', () => {
    const { liq, m } = liquidar(
      lote({ socios, costoInicial: 20000 }),
      [gasto({ monto: 30000, pagadoPor: 0 })],
      [ingreso({ monto: 100000, recibidoPor: 1 })],
    )
    expect(m.ganancia).toBe(50000)
    const suma = liq.socios.reduce((a, s) => a + s.corresponde, 0)
    expect(suma).toBeCloseTo(m.ganancia, 5)
    expect(liq.socios.reduce((a, s) => a + s.ajuste, 0)).toBeCloseTo(0, 5)
  })

  it('el traspaso deja a los dos socios iguales', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 40000, pagadoPor: 0 })],
      [ingreso({ monto: 100000, recibidoPor: 1 })],
    )
    // Ana puso 40.000 y no cobró; Beto cobró 100.000 sin poner nada.
    expect(liq.traspasos).toHaveLength(1)
    expect(liq.traspasos[0]).toMatchObject({ de: 'Beto', a: 'Ana' })
    expect(liq.traspasos[0].monto).toBe(70000)
  })

  it('sin desbalance no manda pagar nada', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 20000, pagadoPor: 0 }), gasto({ id: 2, monto: 20000, pagadoPor: 1 })],
      [ingreso({ monto: 50000, recibidoPor: 0 }), ingreso({ id: 2, monto: 50000, recibidoPor: 1 })],
    )
    expect(liq.traspasos).toHaveLength(0)
  })

  it('reparte entre tres socios desiguales', () => {
    const tres = [
      { nombre: 'Ana', pct: 50 },
      { nombre: 'Beto', pct: 30 },
      { nombre: 'Cid', pct: 20 },
    ]
    const { liq, m } = liquidar(
      lote({ socios: tres, costoInicial: 0 }),
      [gasto({ monto: 100000, pagadoPor: 0 })],
      [ingreso({ monto: 200000, recibidoPor: 0 })],
    )
    expect(m.ganancia).toBe(100000)
    expect(liq.socios.map((s) => Math.round(s.corresponde))).toEqual([50000, 30000, 20000])
    // Ana puso 100.000 y cobró 200.000: le sobran 50.000 sobre lo que le toca.
    expect(liq.socios[0].ajuste).toBeCloseTo(-50000, 5)
    expect(liq.traspasos).toEqual([
      { de: 'Ana', a: 'Beto', monto: 30000 },
      { de: 'Ana', a: 'Cid', monto: 20000 },
    ])
  })
})
