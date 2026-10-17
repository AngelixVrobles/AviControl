import { describe, expect, it } from 'vitest'
import { cobradoDe, compradoresConocidos, cuentasPorCobrar, pendienteDe } from './cobros'
import { computeMetrics } from './metrics'
import { ingreso, lote } from '../test/fixtures'

describe('ventas a crédito', () => {
  it('una venta de contado se cobró completa', () => {
    const i = ingreso({ monto: 50000 })
    expect(cobradoDe(i)).toBe(50000)
    expect(pendienteDe(i)).toBe(0)
  })

  it('a crédito entra lo que se ha cobrado', () => {
    const i = ingreso({
      monto: 50000,
      credito: true,
      cobros: [
        { fecha: '2026-10-01', monto: 20000 },
        { fecha: '2026-10-08', monto: 10000 },
      ],
    })
    expect(cobradoDe(i)).toBe(30000)
    expect(pendienteDe(i)).toBe(20000)
  })

  it('lo vendido cuenta en la ganancia aunque falte cobrarlo', () => {
    const m = computeMetrics(lote({ costoInicial: 10000 }), [], [], [
      ingreso({ cantidad: 100, monto: 60000, credito: true, cobros: [] }),
    ])
    expect(m.ingresos).toBe(60000)
    expect(m.ganancia).toBe(50000)
    expect(m.porCobrar).toBe(60000)
  })
})

describe('cuentasPorCobrar', () => {
  const hoy = '2026-10-20'
  const lotes = [lote({ id: 1, nombre: 'Galpón 1' })]

  it('agrupa por comprador, el que más debe primero y su venta más vieja primero', () => {
    const r = cuentasPorCobrar(
      [
        ingreso({ id: 1, comprador: 'Don Ramón', monto: 30000, fecha: '2026-10-15', credito: true }),
        ingreso({ id: 2, comprador: 'Pollera La Fe', monto: 80000, fecha: '2026-10-10', credito: true, cobros: [{ fecha: '2026-10-12', monto: 30000 }] }),
        ingreso({ id: 3, comprador: 'don ramón', monto: 10000, fecha: '2026-10-01', credito: true }),
        ingreso({ id: 4, comprador: 'Contado', monto: 99999, fecha: '2026-10-01' }),
      ],
      lotes,
      hoy,
    )
    expect(r.total).toBe(30000 + 50000 + 10000)
    expect(r.compradores.map((c) => c.comprador)).toEqual(['Pollera La Fe', 'Don Ramón', 'don ramón'])
    expect(r.compradores[0].ventas[0].lote?.nombre).toBe('Galpón 1')
    expect(r.compradores[0].masVieja).toBe(10)
  })

  it('lo ya cobrado completo no aparece', () => {
    const r = cuentasPorCobrar(
      [ingreso({ comprador: 'X', monto: 1000, credito: true, cobros: [{ fecha: hoy, monto: 1000 }] })],
      lotes,
      hoy,
    )
    expect(r.compradores).toHaveLength(0)
  })
})

describe('compradoresConocidos', () => {
  it('sin repetir y el más reciente primero', () => {
    const lista = compradoresConocidos([
      ingreso({ id: 1, comprador: 'Don Ramón', fecha: '2026-08-01' }),
      ingreso({ id: 2, comprador: 'Pollera La Fe', fecha: '2026-09-01' }),
      ingreso({ id: 3, comprador: ' don ramón ', fecha: '2026-10-01' }),
      ingreso({ id: 4, fecha: '2026-10-02' }),
    ])
    expect(lista).toEqual(['don ramón', 'Pollera La Fe'])
  })
})
