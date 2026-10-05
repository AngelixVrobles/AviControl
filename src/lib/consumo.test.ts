import { describe, expect, it } from 'vitest'
import { consumoAlimento } from './consumo'
import { gasto, hace, lote, registro } from '../test/fixtures'

const compra = (qq: number | undefined, dia = 0, id = dia + 1) =>
  gasto({ id, categoria: 'alimento', monto: 1000, cantidadQq: qq, fecha: hace(30 - dia) })
const conteo = (dia: number, qq: number) => ({ fecha: hace(30 - dia), qq })

describe('consumoAlimento', () => {
  it('sin conteos suma lo anotado y llega hasta el último día con dato', () => {
    const c = consumoAlimento(
      lote(),
      [registro(3, { alimentoLb: 40 }), registro(4, { alimentoLb: 50 }), registro(5)],
      [],
    )
    expect(c.totalLb).toBe(90)
    expect(c.porConteoLb).toBe(0)
    expect(c.hastaDia).toBe(4)
  })

  it('sin alimento no hay último día con dato', () => {
    const c = consumoAlimento(lote(), [registro(3), registro(4)], [compra(20)])
    expect(c.totalLb).toBe(0)
    expect(c.hastaDia).toBeUndefined()
  })

  // El caso de quien no pesa el alimento: compró 20 qq, el día 14 cuenta 7 en el
  // almacén y la app tiene que saber que se dieron 13.
  it('lo comprado menos lo que queda es lo que se dio', () => {
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(14, 7)] }), [registro(5)], [compra(20)])
    expect(c.totalLb).toBeCloseTo(1300, 5)
    expect(c.porConteoLb).toBeCloseTo(1300, 5)
    expect(c.hastaDia).toBe(14)
  })

  it('reparte el conteo con la curva: el día 14 come más que el día 3', () => {
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(14, 7)] }), [], [compra(20)])
    const dia = (d: number) => c.dias.find((x) => x.dia === d)!.lb
    expect(dia(14)).toBeGreaterThan(dia(3) * 2)
  })

  it('respeta lo anotado y reparte el resto entre los días sin dato', () => {
    const anotados = [1, 2, 3, 4, 5].map((d) => registro(d, { alimentoLb: 20 }))
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(10, 7)] }), anotados, [compra(10)])
    expect(c.totalLb).toBeCloseTo(300, 5)
    for (const d of [1, 2, 3, 4, 5]) expect(c.dias.find((x) => x.dia === d)!.lb).toBe(20)
    const libres = c.dias.filter((x) => x.dia >= 6)
    expect(libres.reduce((a, x) => a + x.lb, 0)).toBeCloseTo(200, 5)
    expect(libres.every((x) => x.anotadoLb === 0)).toBe(true)
  })

  // Si todos los días tienen dato y el conteo dice más, el alimento se fue sin
  // anotar (desperdicio): el conteo manda porque es lo que de verdad salió.
  it('con todos los días anotados, lo que falta se suma en proporción', () => {
    const anotados = [0, 1, 2, 3, 4].map((d) => registro(d, { alimentoLb: 20 }))
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(4, 8)] }), anotados, [compra(10)])
    expect(c.totalLb).toBeCloseTo(200, 5)
    expect(c.anotadoLb).toBe(100)
    expect(c.dias.every((x) => x.lb > x.anotadoLb)).toBe(true)
  })

  // Un conteo nunca borra lo anotado: si no cuadra, lo probable es una compra
  // que no se anotó, y se avisa.
  it('avisa cuando lo anotado pasa de lo que sale de las compras', () => {
    const anotados = [1, 2, 3].map((d) => registro(d, { alimentoLb: 100 }))
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(5, 4)] }), anotados, [compra(5)])
    expect(c.totalLb).toBe(300)
    expect(c.descuadres).toHaveLength(1)
    expect(c.descuadres[0].qq).toBeCloseTo(2, 5)
  })

  it('no avisa por medio saco de diferencia', () => {
    const anotados = [registro(3, { alimentoLb: 130 })]
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(5, 4)] }), anotados, [compra(5)])
    expect(c.descuadres).toHaveLength(0)
  })

  it('cada conteo reparte solo su tramo', () => {
    const c = consumoAlimento(
      lote({ conteosAlimento: [conteo(14, 12), conteo(7, 8)] }),
      [],
      [compra(10, 0), compra(10, 10)],
    )
    const hasta = (d: number) => c.dias.filter((x) => x.dia <= d).reduce((a, x) => a + x.lb, 0)
    expect(hasta(7)).toBeCloseTo(200, 5)
    expect(hasta(14)).toBeCloseTo(800, 5)
    expect(c.hastaDia).toBe(14)
  })

  it('lo anotado después del último conteo suma tal cual', () => {
    const c = consumoAlimento(
      lote({ conteosAlimento: [conteo(10, 5)] }),
      [registro(12, { alimentoLb: 150 })],
      [compra(10)],
    )
    expect(c.totalLb).toBeCloseTo(650, 5)
    expect(c.hastaDia).toBe(12)
  })

  // Sin los quintales de una compra no se sabe cuánto entró: el conteo se guarda
  // pero no se usa hasta que se anoten.
  it('ignora los conteos si una compra no tiene quintales', () => {
    const c = consumoAlimento(
      lote({ conteosAlimento: [conteo(14, 7)] }),
      [registro(3, { alimentoLb: 40 })],
      [compra(20, 0, 1), compra(undefined, 5, 2)],
    )
    expect(c.totalLb).toBe(40)
    expect(c.conteosSinUsar).toBe(true)
    expect(c.conteos).toHaveLength(0)
  })

  it('no usa conteos de antes del ciclo ni de después del cierre', () => {
    const l = lote({
      conteosAlimento: [{ fecha: hace(40), qq: 2 }, conteo(29, 1)],
      estado: 'cerrado',
      fechaCierre: hace(5),
    })
    const c = consumoAlimento(l, [], [compra(20)])
    expect(c.totalLb).toBe(0)
    expect(c.conteos).toHaveLength(0)
  })

  it('un conteo con más sacos de los comprados no inventa consumo negativo', () => {
    const c = consumoAlimento(lote({ conteosAlimento: [conteo(10, 30)] }), [], [compra(20)])
    expect(c.totalLb).toBe(0)
    expect(c.dias).toHaveLength(0)
    expect(c.descuadres[0].qq).toBeCloseTo(10, 5)
  })

  it('ignora el alimento que no es un número', () => {
    const c = consumoAlimento(lote(), [registro(3, { alimentoLb: NaN }), registro(4, { alimentoLb: 10 })], [])
    expect(c.totalLb).toBe(10)
  })
})
