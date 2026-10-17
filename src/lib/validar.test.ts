import { describe, expect, it } from 'vitest'
import { primerProblema, revisarFilas } from './validar'
import { gasto, lote, registro } from '../test/fixtures'

describe('revisarFilas', () => {
  it('deja pasar lo que tiene la forma', () => {
    expect(revisarFilas('lotes', [lote()])).toBeUndefined()
    expect(revisarFilas('registros', [registro(1), registro(2)])).toBeUndefined()
  })

  it('dice cuántas filas vienen mal', () => {
    expect(revisarFilas('registros', [registro(1), { ...registro(2), fecha: 12 }, null])).toBe(
      '2 días anotados vienen incompletos o dañados',
    )
    expect(revisarFilas('gastos', [{ ...gasto(), monto: 'mil' }])).toBe('1 gasto viene incompleto o dañado')
  })

  it('no acepta dos filas con el mismo número', () => {
    expect(revisarFilas('registros', [registro(1), registro(1)])).toBe('1 día anotado repite el número de otro')
  })

  it('sin números propios no los pide', () => {
    const { id: _id, ...sinId } = registro(1)
    expect(revisarFilas('registros', [sinId], { conId: false })).toBeUndefined()
    expect(revisarFilas('registros', [sinId])).toBeDefined()
  })

  it('una lista que no es lista no se puede leer', () => {
    expect(revisarFilas('ingresos', 'nada')).toBe('la lista de ventas no se puede leer')
  })

  it('un monto que no es un número finito no pasa', () => {
    expect(revisarFilas('gastos', [{ ...gasto(), monto: Infinity }])).toBeDefined()
  })

  it('primerProblema da el de la primera lista con algo mal', () => {
    expect(
      primerProblema([
        ['lotes', [lote()]],
        ['gastos', [{ ...gasto(), fecha: '' }]],
      ]),
    ).toBe('1 gasto viene incompleto o dañado')
  })
})

describe('lo que va dentro de cada fila', () => {
  it('un cobro con el monto como texto no pasa', () => {
    const venta = { id: 1, loteId: 1, tipo: 'aves', cantidad: 10, monto: 9000, fecha: '2026-10-01', credito: true, cobros: [{ fecha: 'ayer', monto: '5000' }], creado: 0 }
    expect(revisarFilas('ingresos', [venta])).toBe('1 venta viene incompleta o dañada')
  })

  it('un socio sin nombre de texto no pasa', () => {
    expect(revisarFilas('lotes', [lote({ socios: [{ nombre: 3 as unknown as string, pct: 50 }] })])).toBeDefined()
  })

  it('las aves que se pasaron de galpón y el galpón de una venta se revisan', () => {
    const bien = lote({ movimientos: [{ fecha: '2026-10-01', de: 'g1', a: 'g2', aves: 350 }] })
    const mal = lote({ movimientos: [{ fecha: '2026-10-01', de: 'g1', a: 'g2', aves: '350' as unknown as number }] })
    expect(revisarFilas('lotes', [bien])).toBeUndefined()
    expect(revisarFilas('lotes', [mal])).toBe('1 ciclo viene incompleto o dañado')
    const venta = { id: 1, loteId: 1, tipo: 'aves', cantidad: 10, monto: 9000, fecha: '2026-10-01', creado: 0 }
    expect(revisarFilas('ingresos', [{ ...venta, galponId: 'g2' }])).toBeUndefined()
    expect(revisarFilas('ingresos', [{ ...venta, galponId: 2 }])).toBeDefined()
  })
})
