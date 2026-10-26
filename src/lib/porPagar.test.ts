import { describe, expect, it } from 'vitest'
import { pagoEmpleados, totalPorVenir } from './porPagar'
import { gasto } from '../test/fixtures'

describe('pagoEmpleados', () => {
  const ciclo = { diaVenta: 42, aves: 1000 }

  it('sin pago anotado no hay nada que estimar', () => {
    expect(pagoEmpleados(undefined, [], ciclo)).toBeUndefined()
    expect(pagoEmpleados({ monto: 0, cada: 'semana' }, [], ciclo)).toBeUndefined()
  })

  // Pagados a la semana, un ciclo que se vende el día 42 son seis semanas.
  it('por tiempo, los días del ciclo hasta la venta', () => {
    expect(pagoEmpleados({ monto: 3000, cada: 'semana' }, [], ciclo)!.total).toBe(18000)
    expect(pagoEmpleados({ monto: 500, cada: 'dia' }, [], ciclo)!.total).toBe(21000)
    expect(pagoEmpleados({ monto: 15000, cada: 'mes' }, [], ciclo)!.total).toBe(21000)
    expect(pagoEmpleados({ monto: 7500, cada: 'quincena' }, [], ciclo)!.total).toBe(21000)
  })

  it('por la pollada, la suma tal cual; por pollo, las aves que salen', () => {
    expect(pagoEmpleados({ monto: 20000, cada: 'ciclo' }, [], ciclo)!.total).toBe(20000)
    expect(pagoEmpleados({ monto: 3, cada: 'ave' }, [], ciclo)!.total).toBe(3000)
  })

  // Lo que ya se les pagó está en los gastos de mano de obra: contarlo otra
  // vez inflaba lo que falta.
  it('descuenta lo ya anotado como mano de obra, y nada más', () => {
    const gastos = [
      gasto({ id: 1, categoria: 'mano_obra', monto: 6000 }),
      gasto({ id: 2, categoria: 'mano_obra', monto: 6000 }),
      gasto({ id: 3, categoria: 'arreglo', monto: 900 }),
    ]
    expect(pagoEmpleados({ monto: 3000, cada: 'semana' }, gastos, ciclo)).toEqual({
      total: 18000,
      anotado: 12000,
      falta: 6000,
    })
  })

  it('lo que falta no baja de cero si ya se pagó de más', () => {
    const gastos = [gasto({ categoria: 'mano_obra', monto: 25000 })]
    expect(pagoEmpleados({ monto: 20000, cada: 'ciclo' }, gastos, ciclo)!.falta).toBe(0)
  })

  it('un pago con una frecuencia que no existe no se estima', () => {
    expect(pagoEmpleados({ monto: 100, cada: 'año' as never }, [], ciclo)).toBeUndefined()
  })
})

describe('totalPorVenir', () => {
  it('suma lo que viene, sin montos negativos', () => {
    expect(
      totalPorVenir({
        gastosPorVenir: [
          { concepto: 'Luz', monto: 2500, categoria: 'energia' },
          { concepto: 'Camión', monto: 1500, categoria: 'transporte' },
          { concepto: 'Error', monto: -900, categoria: 'otros' },
        ],
      }),
    ).toBe(4000)
    expect(totalPorVenir({})).toBe(0)
  })
})
