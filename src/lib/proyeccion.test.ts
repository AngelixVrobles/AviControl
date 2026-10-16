import { describe, expect, it } from 'vitest'
import { proyectarVenta } from './proyeccion'
import { computeMetrics } from './metrics'
import { gasto, lote, registro } from '../test/fixtures'
import { pesoEstandarLb } from './standards'

const gastos = [gasto({ categoria: 'alimento', monto: 76000, cantidadQq: 40 })]

function proyectar(pesoDia30: number, objetivo = 5.5) {
  const l = lote({ precioVentaLb: 60 })
  const registros = [registro(30, { pesoPromedio: pesoDia30, alimentoLb: 4000 })]
  const m = computeMetrics(l, registros, gastos, [])
  return { p: proyectarVenta(l, registros, gastos, m, objetivo), m }
}

describe('proyectarVenta', () => {
  it('sin pesajes no proyecta nada', () => {
    const l = lote()
    const m = computeMetrics(l, [], gastos, [])
    expect(proyectarVenta(l, [], gastos, m, 5.5)).toBeNull()
  })

  it('marca listo cuando ya pasó el peso objetivo', () => {
    const { p } = proyectar(5.8)
    expect(p!.listo).toBe(true)
    expect(p!.alimentoRestanteLb).toBe(0)
    expect(p!.pesoVentaLb).toBe(5.8)
  })

  it('proyecta al peso objetivo cuando todavía no llega', () => {
    const { p } = proyectar(pesoEstandarLb(30))
    expect(p!.listo).toBe(false)
    expect(p!.pesoVentaLb).toBe(5.5)
    expect(p!.diaVenta).toBeGreaterThan(30)
    expect(p!.alimentoRestanteLb).toBeGreaterThan(0)
  })

  // Las aves que faltan por morirse no se venden: contarlas infla las libras.
  it('descuenta la mortalidad que falta por ocurrir', () => {
    const { p, m } = proyectar(4)
    expect(p!.avesAlVender).toBeLessThan(m.avesVivas)
    expect(p!.lbEnPie).toBe(Math.round(p!.avesAlVender * p!.pesoVentaLb))
  })

  it('un lote lento tarda más y come más', () => {
    const rapido = proyectar(pesoEstandarLb(30))
    const lento = proyectar(pesoEstandarLb(30) * 0.85)
    expect(lento.p!.diaVenta).toBeGreaterThan(rapido.p!.diaVenta)
    expect(lento.p!.alimentoRestanteLb).toBeGreaterThan(rapido.p!.alimentoRestanteLb)
  })

  it('el precio de equilibrio cubre exactamente el costo proyectado', () => {
    const { p } = proyectar(4)
    expect(p!.precioEquilibrioLb * p!.lbEnPie).toBeCloseTo(p!.costoProyectado, 0)
  })

  it('el costo proyectado incluye el alimento que falta comprar', () => {
    const { p, m } = proyectar(4)
    expect(p!.costoProyectado).toBeGreaterThan(m.costos)
    expect(p!.costoProyectado).toBeCloseTo(m.costos + p!.costoRestante, 5)
  })

  it('no proyecta un peso que la curva no alcanza', () => {
    expect(proyectar(4, 99).p).toBeNull()
  })

  // El alimento comprado por adelantado ya está en los costos: si además se
  // cobra como consumo futuro, el precio de equilibrio sube en todo lo que hay
  // en el almacén.
  describe('alimento en el almacén', () => {
    const l = lote({ precioVentaLb: 60 })
    const registros = [registro(30, { pesoPromedio: 4, alimentoLb: 4000 })]
    const proyectarCon = (compras: ReturnType<typeof gasto>[]) => {
      const m = computeMetrics(l, registros, compras, [])
      return { p: proyectarVenta(l, registros, compras, m, 5.5)!, m }
    }
    // 40 qq comprados y 40 dados: el almacén está vacío.
    const justo = [gasto({ id: 1, categoria: 'alimento', monto: 76000, cantidadQq: 40 })]
    const conAdelanto = (qq: number) => [
      ...justo,
      gasto({ id: 2, categoria: 'alimento', monto: 1900 * qq, cantidadQq: qq }),
    ]

    it('comprar por adelantado no cambia el costo proyectado', () => {
      const sinStock = proyectarCon(justo).p
      const conStock = proyectarCon(conAdelanto(10)).p
      expect(sinStock.existenciaLb).toBe(0)
      expect(conStock.existenciaLb).toBeCloseTo(1000, 5)
      expect(conStock.alimentoRestanteLb).toBe(sinStock.alimentoRestanteLb)
      expect(conStock.alimentoPorComprarLb).toBeCloseTo(sinStock.alimentoRestanteLb - 1000, 5)
      expect(conStock.costoProyectado).toBeCloseTo(sinStock.costoProyectado, 5)
      expect(conStock.precioEquilibrioLb).toBeCloseTo(sinStock.precioEquilibrioLb, 5)
    })

    it('si lo del almacén alcanza hasta la venta no falta nada por comprar', () => {
      const { p, m } = proyectarCon(conAdelanto(80))
      expect(p.alimentoPorComprarLb).toBe(0)
      expect(p.costoRestante).toBe(0)
      expect(p.costoProyectado).toBe(m.costos)
      expect(p.sobranteLb).toBeCloseTo(8000 - p.alimentoRestanteLb, 5)
    })

    // Con una compra sin quintales no se sabe cuánto hay: se supone que todo
    // falta por comprar, que se equivoca hacia el lado seguro.
    it('sin los quintales de todas las compras no descuenta nada', () => {
      const { p } = proyectarCon([
        ...conAdelanto(10),
        gasto({ id: 3, categoria: 'alimento', monto: 5000 }),
      ])
      expect(p.existenciaLb).toBe(0)
      expect(p.alimentoPorComprarLb).toBe(p.alimentoRestanteLb)
    })
  })
})
