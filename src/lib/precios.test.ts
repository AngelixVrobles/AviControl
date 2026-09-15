import { describe, expect, it } from 'vitest'
import { analizarPrecio, precioAlimentoLb, precioQuintalReal } from './precios'
import { computeMetrics } from './metrics'
import { gasto, lote, registro } from '../test/fixtures'

describe('precioQuintalReal', () => {
  // Promedio PONDERADO: 20 qq a 1.900 y 40 a 2.050 no da 1.975, da 2.000.
  it('pondera por quintales, no por compra', () => {
    const precio = precioQuintalReal([
      gasto({ id: 1, categoria: 'alimento', monto: 38000, cantidadQq: 20 }),
      gasto({ id: 2, categoria: 'alimento', monto: 82000, cantidadQq: 40 }),
    ])
    expect(precio).toBe(2000)
  })

  it('ignora las compras sin cantidad anotada', () => {
    const precio = precioQuintalReal([
      gasto({ id: 1, categoria: 'alimento', monto: 38000, cantidadQq: 20 }),
      gasto({ id: 2, categoria: 'alimento', monto: 99999 }),
    ])
    expect(precio).toBe(1900)
  })

  it('es undefined si ninguna compra trae quintales', () => {
    expect(precioQuintalReal([gasto({ categoria: 'alimento', monto: 38000 })])).toBeUndefined()
    expect(precioQuintalReal([])).toBeUndefined()
  })
})

describe('precioAlimentoLb', () => {
  const m = computeMetrics(lote(), [registro(1, { alimentoLb: 1000 })], [], [])

  it('manda lo que de verdad se pagó por quintal', () => {
    const gastos = [gasto({ categoria: 'alimento', monto: 38000, cantidadQq: 20 })]
    expect(precioAlimentoLb(lote({ precioQuintal: 9999 }), gastos, m)).toBe(19)
  })

  it('si no hay quintales anotados usa el precio puesto a mano', () => {
    const gastos = [gasto({ categoria: 'alimento', monto: 38000 })]
    expect(precioAlimentoLb(lote({ precioQuintal: 2000 }), gastos, m)).toBe(20)
  })

  it('de último estima entre lo gastado y lo consumido', () => {
    const gastos = [gasto({ categoria: 'alimento', monto: 38000 })]
    expect(precioAlimentoLb(lote(), gastos, m)).toBe(38)
  })
})

describe('analizarPrecio', () => {
  const l = lote({ costoInicial: 24000, precioVentaLb: 60 })
  const gastos = [gasto({ categoria: 'alimento', monto: 76000, cantidadQq: 40 })]
  const registros = [registro(30, { pesoPromedio: 5.5, alimentoLb: 4000 })]
  const m = computeMetrics(l, registros, gastos, [])
  const a = analizarPrecio(l, gastos, m, null)!

  it('el precio de equilibrio deja la ganancia exactamente en cero', () => {
    expect(a.precioEquilibrioLb * a.lbEnPie).toBeCloseTo(a.costoNeto, 5)
    expect(a.escalones[0].ganancia).toBeCloseTo(0, 5)
  })

  it('cada escalón entrega el margen que promete', () => {
    for (const e of a.escalones) {
      const ingreso = e.precioLb * a.lbEnPie
      expect((e.ganancia / ingreso) * 100).toBeCloseTo(e.margenPct, 5)
    }
  })

  it('los escalones suben de precio y de ganancia', () => {
    for (let i = 1; i < a.escalones.length; i++) {
      expect(a.escalones[i].precioLb).toBeGreaterThan(a.escalones[i - 1].precioLb)
      expect(a.escalones[i].ganancia).toBeGreaterThan(a.escalones[i - 1].ganancia)
    }
  })

  it('el desglose del costo suma el total', () => {
    expect(a.costoAlimento + a.costoAves + a.costoOtros).toBeCloseTo(a.costoTotal, 5)
  })

  it('sitúa el precio del productor contra el equilibrio', () => {
    expect(a.actual!.precioLb).toBe(60)
    expect(a.actual!.sobreEquilibrioPct).toBeGreaterThan(0)
    expect(a.actual!.ganancia).toBeCloseTo(60 * a.lbEnPie - a.costoNeto, 5)
  })

  it('sin peso no hay libras que vender y no devuelve nada', () => {
    const vacio = computeMetrics(l, [], gastos, [])
    expect(analizarPrecio(l, gastos, vacio, null)).toBeNull()
  })
})
