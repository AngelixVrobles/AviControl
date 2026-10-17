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
