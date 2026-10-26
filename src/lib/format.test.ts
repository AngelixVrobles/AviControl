import { describe, expect, it } from 'vitest'
import { desdeHace, diaLocal, enumerar } from './format'

describe('enumerar', () => {
  it('junta lo que hay con comas y una «y» al final, sin lo que está en cero', () => {
    expect(
      enumerar([
        [3, 'ciclo', 'ciclos'],
        [0, 'pesaje', 'pesajes'],
        [1, 'gasto', 'gastos'],
        [12, 'venta', 'ventas'],
      ]),
    ).toBe('3 ciclos, 1 gasto y 12 ventas')
  })

  it('uno solo va sin «y», y nada da vacío', () => {
    expect(enumerar([[2, 'deuda', 'deudas']])).toBe('2 deudas')
    expect(enumerar([[0, 'deuda', 'deudas']])).toBe('')
  })
})

describe('desdeHace', () => {
  it('hoy, ayer y los demás días', () => {
    expect(desdeHace(0)).toBe('desde hoy')
    expect(desdeHace(1)).toBe('desde ayer')
    expect(desdeHace(12)).toBe('desde hace 12 días')
  })
})

describe('diaLocal', () => {
  // El día de un momento en la hora de aquí, no en la de Londres: a las 9 de
  // la noche en Santo Domingo, en Londres ya es mañana.
  it('usa la hora del teléfono', () => {
    const noche = new Date(2026, 9, 19, 21, 41)
    expect(diaLocal(noche)).toBe('2026-10-19')
    expect(diaLocal(noche.toISOString())).toBe('2026-10-19')
  })
})
