import { describe, expect, it } from 'vitest'
import { avesQueSalieron, cuadrarAves, cuadreRaro, pesoEsperadoLb } from './cuadre'
import { hace, ingreso, lote } from '../test/fixtures'

// La hoja del cuaderno: cinco ventas el mismo día, a RD$38, anotadas a 10 por
// caja. Así son 410 pollos; si salieron 452, cada venta lleva lo de sus libras.
const hoy = hace(0)
const venta = (id: number, cajas: number, lb: number, comprador?: string) =>
  ingreso({ id, comprador, cantidad: cajas * 10, pesoLb: lb, monto: lb * 38, fecha: hoy, avesEstimadas: true })
const cuaderno = [
  venta(1, 12, 849),
  venta(2, 9, 484, 'Pequeña Caja'),
  venta(3, 4, 387, 'Nenel'),
  venta(4, 5, 286),
  venta(5, 11, 649),
]
const l = lote({ fechaInicio: hace(40) })
const suma = (xs: number[]) => xs.reduce((a, x) => a + x, 0)

describe('avesQueSalieron', () => {
  it('las que llegaron, menos las muertas en las cajas y las bajas', () => {
    expect(avesQueSalieron({ cantidadInicial: 1000, muertosLlegada: 4 }, 30)).toBe(966)
    expect(avesQueSalieron({ cantidadInicial: 100 }, 120)).toBe(0)
  })
})

describe('cuadrarAves', () => {
  it('reparte por libras las que salieron, como con la hoja del cuaderno', () => {
    const c = cuadrarAves(l, cuaderno, 452)!
    expect(c.cantidades).toEqual([145, 82, 66, 49, 110])
    expect(c.estimadas).toBe(5)
    expect(c.pesoAveLb).toBeCloseTo(2655 / 452, 5)
  })

  it('las ventas contadas se quedan como están', () => {
    const contada = { ...cuaderno[2], avesEstimadas: undefined }
    const c = cuadrarAves(l, [...cuaderno.slice(0, 2), contada, ...cuaderno.slice(3)], 452)!
    expect(c.cantidades[2]).toBe(40)
    expect(suma(c.cantidades)).toBe(452)
    expect(c.estimadas).toBe(4)
  })

  // Se anotaron de más: salieron 380, no 410. También van por libras, así que
  // Nenel, que sobrecargó, sube, y las de cajas chicas bajan.
  it('si salieron menos de las anotadas, también van por libras', () => {
    const c = cuadrarAves(l, cuaderno, 380)!
    expect(c.cantidades).toEqual([122, 69, 55, 41, 93])
    expect(suma(c.cantidades)).toBe(380)
  })

  // En días distintos el pollo del último día pesa más: la misma libra es menos pollo.
  it('en días distintos, la libra del último día es menos pollo', () => {
    const antes = ingreso({ id: 1, cantidad: 100, pesoLb: 500, fecha: hace(4), avesEstimadas: true })
    const despues = ingreso({ id: 2, cantidad: 100, pesoLb: 500, fecha: hoy, avesEstimadas: true })
    const c = cuadrarAves(l, [antes, despues], 200)!
    expect(c.cantidades[0]).toBeGreaterThan(c.cantidades[1])
    expect(suma(c.cantidades)).toBe(200)
  })

  // 450 lb arregladas al 75 % son 600 en pie: lo mismo que 600 lb en pie.
  it('lo arreglado cuenta por lo que pesaba vivo', () => {
    const enPie = ingreso({ id: 1, cantidad: 10, pesoLb: 600, fecha: hoy, avesEstimadas: true })
    const arreglado = ingreso({
      id: 2,
      cantidad: 10,
      pesoLb: 450,
      arreglado: { rindePct: 75 },
      fecha: hoy,
      avesEstimadas: true,
    })
    expect(cuadrarAves(l, [enPie, arreglado], 200)!.cantidades).toEqual([100, 100])
  })

  it('ninguna venta con libras se queda sin aves', () => {
    const grande = ingreso({ id: 1, cantidad: 10, pesoLb: 5000, fecha: hoy, avesEstimadas: true })
    const chica = ingreso({ id: 2, cantidad: 1, pesoLb: 1, fecha: hoy, avesEstimadas: true })
    expect(cuadrarAves(l, [grande, chica], 100)!.cantidades).toEqual([99, 1])
  })

  it('sin ventas estimadas con libras, o sin un pollo para cada una, no se cuadra', () => {
    expect(cuadrarAves(l, cuaderno.map((v) => ({ ...v, avesEstimadas: undefined })), 452)).toBeUndefined()
    expect(cuadrarAves(l, cuaderno, 4)).toBeUndefined()
    expect(cuadrarAves(l, [ingreso({ cantidad: 50, avesEstimadas: true })], 60)).toBeUndefined()
  })
})

describe('cuadreRaro', () => {
  // A los 40 días un Cobb pesa 6.75 lb: 4.1 no puede ser, 5.9 sí.
  it('avisa cuando el cuadre da pollos que no pueden ser', () => {
    const esperado = pesoEsperadoLb(l, hoy)
    expect(esperado).toBeCloseTo(6.75, 2)
    expect(cuadreRaro(4.11, esperado, false)).toBe('livianos')
    expect(cuadreRaro(5.87, esperado, false)).toBeUndefined()
    expect(cuadreRaro(9, esperado, false)).toBe('pesados')
    // Con un pesaje se le cree más a la curva del lote.
    expect(cuadreRaro(5.5, 6.75, true)).toBe('livianos')
    expect(cuadreRaro(5.5, 6.75, false)).toBeUndefined()
  })
})
