import { describe, expect, it } from 'vitest'
import {
  aEdicion,
  avesPorPeso,
  cuadranLasAves,
  errorPesada,
  leerPesada,
  librasDePesada,
  pesadaNueva,
  resumenPesada,
} from './pesada'

// Las cuatro ventas de una página del cuaderno de la granja, a RD$38 la libra.
const cuaderno = {
  // Dos grupos de 6 cajas vacías, 94 lb cada uno; llenas, 503 y 534.
  primera: { vacias: [{ cajas: 6, lb: 94 }, { cajas: 6, lb: 94 }], llenas: [503, 534] },
  // Dos grupos pesados cada uno lleno y vacío: 273 − 45 y 318 − 62.
  pequenaCaja: { vacias: [{ cajas: 4, lb: 45 }, { cajas: 5, lb: 62 }], llenas: [273, 318] },
  // 4 cajas de 62 lb; llenas en dos pesadas, 233 y 216.
  nenel: { vacias: [{ cajas: 4, lb: 62 }], llenas: [233, 216] },
  // 11 cajas, 3 y 8; llenas en cuatro pesadas.
  ultima: { vacias: [{ cajas: 3, lb: 36 }, { cajas: 8, lb: 92 }], llenas: [209, 211, 215, 142] },
}

describe('resumenPesada', () => {
  it('saca las libras de pollo como en el cuaderno', () => {
    const r = resumenPesada(cuaderno.primera)
    expect(r).toMatchObject({ cajas: 12, tara: 188, bruto: 1037, neto: 849 })
    expect(Math.round(r.neto * 38)).toBe(32262)
    expect(resumenPesada(cuaderno.pequenaCaja).neto * 38).toBe(18392)
    expect(resumenPesada(cuaderno.nenel).neto).toBe(387)
    expect(resumenPesada(cuaderno.ultima)).toMatchObject({ cajas: 11, tara: 128, bruto: 777, neto: 649 })
    expect(resumenPesada(cuaderno.ultima).neto * 38).toBe(24662)
  })

  it('dice lo que pesa cada caja, y las aves si se sabe cuántos van por caja', () => {
    expect(resumenPesada(cuaderno.primera).lbPorCaja).toBe(15.67)
    expect(resumenPesada({ ...cuaderno.primera, pollosPorCaja: 10 }).aves).toBe(120)
    expect(resumenPesada(cuaderno.primera).aves).toBeUndefined()
  })

  // Un grupo pesado sin contar sus cajas pesa igual: solo no entra en lo que
  // pesa cada una.
  it('un grupo sin contar cuenta en las libras, no en las cajas', () => {
    const r = resumenPesada({ vacias: [{ cajas: 6, lb: 94 }, { lb: 90 }], llenas: [600] })
    expect(r).toMatchObject({ cajas: 6, tara: 184, neto: 416, lbPorCaja: 15.67 })
  })

  it('sin decimales de más al sumar', () => {
    expect(resumenPesada({ vacias: [{ lb: 94.4 }, { lb: 94.2 }], llenas: [500.1] }).neto).toBe(311.5)
  })
})

describe('lo que se escribe en la hoja', () => {
  it('las filas vacías no cuentan', () => {
    const p = leerPesada({
      vacias: [{ cajas: '6', lb: '94' }, { cajas: '', lb: '' }],
      llenas: ['503', '', '534'],
      pollosPorCaja: '',
    })
    expect(p).toEqual({ vacias: [{ cajas: 6, lb: 94 }], llenas: [503, 534] })
  })

  it('sin pesadas llenas todavía no hay libras', () => {
    expect(librasDePesada(leerPesada({ ...pesadaNueva(), vacias: [{ cajas: '6', lb: '94' }] }))).toBe(0)
    expect(librasDePesada(cuaderno.nenel)).toBe(387)
  })

  it('vuelve a la hoja tal como se guardó', () => {
    expect(leerPesada(aEdicion(cuaderno.ultima))).toEqual(cuaderno.ultima)
    expect(aEdicion({ vacias: [], llenas: [] })).toEqual(pesadaNueva())
  })

  it('no deja guardar números negativos ni cajas llenas más livianas que vacías', () => {
    expect(errorPesada({ ...pesadaNueva(), llenas: ['-5'] })).toMatch(/negativo/)
    expect(errorPesada({ vacias: [{ cajas: '6', lb: '940' }], llenas: ['503'], pollosPorCaja: '' })).toMatch(
      /pesan menos/,
    )
    expect(errorPesada({ vacias: [{ cajas: '6', lb: '94' }], llenas: ['503'], pollosPorCaja: '' })).toBeUndefined()
    // A medio llenar no es un error: falta lo lleno.
    expect(errorPesada({ ...pesadaNueva(), vacias: [{ cajas: '6', lb: '94' }] })).toBeUndefined()
  })
})

describe('las aves que se fueron', () => {
  // 849 lb de pollo: con 7 lb cada uno son 121, casi lo de 12 cajas de 10.
  it('por el peso, con lo que pesa hoy cada pollo', () => {
    expect(avesPorPeso(849, 7)).toBe(121)
    expect(avesPorPeso(849, undefined)).toBeUndefined()
    expect(avesPorPeso(0, 7)).toBeUndefined()
  })

  // Si pesan 6.4 lb, 849 lb son 133 pollos: unos 11 por caja, no 10.
  it('avisa cuando por el peso van más de los que se contaron por caja', () => {
    expect(cuadranLasAves(120, avesPorPeso(849, 6.4))).toBe('mas')
    expect(cuadranLasAves(120, 121)).toBeUndefined()
    expect(cuadranLasAves(120, 108)).toBe('menos')
    expect(cuadranLasAves(undefined, 121)).toBeUndefined()
  })
})
