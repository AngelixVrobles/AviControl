import { describe, expect, it } from 'vitest'
import { alimentoEn, desdeHace, diaLocal, enumerar, fecha, money, numCompacto } from './format'

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

describe('cifras cortas', () => {
  // «471.6 mil» y «1.2 M», como se dice aquí: es-DO daba «8 K» y «16 k».
  it('miles y millones en palabras de aquí', () => {
    expect(numCompacto(8000)).toBe('8 mil')
    expect(numCompacto(47_520)).toBe('47.5 mil')
    expect(numCompacto(155_900)).toBe('156 mil')
    expect(numCompacto(999_700)).toBe('1 M')
    expect(numCompacto(1_250_000)).toBe('1.3 M')
    expect(numCompacto(-16_000)).toBe('−16 mil')
    expect(numCompacto(950)).toBe('950')
  })

  it('el dinero corto lleva la moneda', () => {
    expect(money(395_300, { compact: true })).toBe('RD$395 mil')
    expect(money(900, { compact: true })).toBe('RD$900')
  })
})

describe('fechas y alimento', () => {
  it('«3 nov», sin el cero de relleno', () => {
    expect(fecha('2026-11-03')).toBe('3 nov')
  })

  it('el alimento en quintales con un decimal', () => {
    expect(alimentoEn(424, 'qq')).toBe('4.2 qq')
    expect(alimentoEn(700, 'qq')).toBe('7 qq')
    expect(alimentoEn(424, 'lb')).toBe('424 lb')
  })
})
