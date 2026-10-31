import { describe, expect, it } from 'vitest'
import {
  EN_PIE,
  arregladoContraPie,
  lbEnPieDe,
  modoVenta,
  precioDe,
  precioPromedio,
  preciosDeVenta,
  valorHoy,
} from './venta'
import { hace, ingreso } from '../test/fixtures'

describe('modoVenta', () => {
  it('en pie se cobra la libra viva, sin costo de arreglo', () => {
    expect(modoVenta({ venta: 'pie', rindePct: 70, costoArregloAve: 20 })).toEqual(EN_PIE)
  })

  it('arreglado lleva el rinde y lo que cuesta arreglar cada pollo', () => {
    expect(modoVenta({ venta: 'arreglado', rindePct: 72, costoArregloAve: 15 })).toEqual({
      arreglado: true,
      rinde: 0.72,
      costoAve: 15,
    })
  })

  // Un rinde de 7 % o de 120 % es un dedo que se fue: se usa el de costumbre.
  it('un rinde imposible vuelve al de costumbre', () => {
    expect(modoVenta({ venta: 'arreglado', rindePct: 7, costoArregloAve: -5 })).toEqual({
      arreglado: true,
      rinde: 0.75,
      costoAve: 0,
    })
  })
})

describe('lbEnPieDe', () => {
  it('las libras en pie son las de la báscula', () => {
    expect(lbEnPieDe(ingreso({ pesoLb: 400 }))).toBe(400)
  })

  // 300 lb arregladas a 75 % salieron del galpón pesando 400.
  it('las arregladas se llevan a lo que pesaban vivas', () => {
    expect(lbEnPieDe(ingreso({ pesoLb: 300, arreglado: { rindePct: 75 } }))).toBe(400)
  })

  it('sin peso no hay libras', () => {
    expect(lbEnPieDe(ingreso({ pesoLb: undefined }))).toBe(0)
  })
})

describe('precioDe', () => {
  // El total se redondea a pesos: 12.3 lb a 65 son 800, y 800 / 12.3 = 65.04.
  it('manda el precio que se puso', () => {
    expect(precioDe(ingreso({ pesoLb: 12.3, monto: 800, precioLb: 65 }))).toBe(65)
  })

  it('sin precio guardado, el total entre las libras', () => {
    expect(precioDe(ingreso({ pesoLb: 100, monto: 6000 }))).toBe(60)
  })

  it('sin libras no hay precio por libra', () => {
    expect(precioDe(ingreso({ monto: 6000 }))).toBeUndefined()
  })
})

describe('precioPromedio', () => {
  // A cada quien su precio: el que compró más libras pesa más.
  it('pondera por las libras de cada comprador', () => {
    const ventas = [
      ingreso({ id: 1, pesoLb: 100, monto: 6500, arreglado: { rindePct: 75 } }),
      ingreso({ id: 2, pesoLb: 300, monto: 13200, arreglado: { rindePct: 75 } }),
      ingreso({ id: 3, pesoLb: 1000, monto: 32000 }),
    ]
    expect(precioPromedio(ventas, true)).toBeCloseTo(19700 / 400, 6)
    expect(precioPromedio(ventas, false)).toBe(32)
  })

  it('sin ventas pesadas no hay promedio', () => {
    expect(precioPromedio([ingreso({ monto: 500 })], true)).toBeUndefined()
  })
})

describe('preciosDeVenta', () => {
  const ventas = [
    ingreso({ id: 1, fecha: hace(5), comprador: 'Juan', pesoLb: 10, monto: 600, precioLb: 60, arreglado: { rindePct: 75 } }),
    ingreso({ id: 2, fecha: hace(3), comprador: 'Marta', pesoLb: 10, monto: 650, precioLb: 65, arreglado: { rindePct: 75 } }),
    ingreso({ id: 3, fecha: hace(2), comprador: 'juan ', pesoLb: 10, monto: 550, precioLb: 55, arreglado: { rindePct: 75 } }),
    ingreso({ id: 4, fecha: hace(1), comprador: 'Compadre', pesoLb: 10, monto: 440, precioLb: 44, arreglado: { rindePct: 75 } }),
    ingreso({ id: 5, fecha: hace(1), comprador: 'Pollero', pesoLb: 1000, monto: 32000, precioLb: 32 }),
    ingreso({ id: 6, fecha: hace(0), comprador: 'Ana', pesoLb: 10, monto: 600, precioLb: 60, arreglado: { rindePct: 75 } }),
  ]
  const p = preciosDeVenta(ventas)

  it('los precios de las últimas ventas, sin repetir, por cómo se vendieron', () => {
    expect(p.recientes.arreglado).toEqual([60, 44, 55, 65])
    expect(p.recientes.pie).toEqual([32])
  })

  // Cada quien paga su precio: el de la última vez, sin importar mayúsculas.
  it('recuerda el último precio de cada comprador', () => {
    expect(p.porComprador.get('juan')).toEqual({ precio: 55, arreglado: true })
    expect(p.porComprador.get('pollero')).toEqual({ precio: 32, arreglado: false })
  })
})

describe('las cajas de cada pollero', () => {
  // Nenel trae sus cajas de 15.5 lb y le caben 10 pollos.
  const ventas = [
    ingreso({
      id: 1,
      fecha: hace(9),
      comprador: 'Nenel',
      pesoLb: 387,
      monto: 14700,
      precioLb: 38,
      pesada: { vacias: [{ cajas: 4, lb: 62 }], llenas: [233, 216], pollosPorCaja: 10 },
    }),
    ingreso({ id: 2, fecha: hace(2), comprador: 'Ana', pesoLb: 10, monto: 600, precioLb: 60 }),
  ]

  it('recuerda lo que pesa cada caja y cuántos pollos llevaba', () => {
    const p = preciosDeVenta(ventas)
    expect(p.cajasDe.get('nenel')).toEqual({ lbPorCaja: 15.5, pollosPorCaja: 10 })
    expect(p.cajasDe.has('ana')).toBe(false)
  })

  // Quien vende por cajas sigue igual: la hoja abre con la pesada puesta.
  it('si la última venta se pesó por cajas, la próxima también', () => {
    expect(preciosDeVenta(ventas).porCajas).toBe(false)
    expect(preciosDeVenta([...ventas, { ...ventas[0], id: 3, fecha: hace(0) }]).porCajas).toBe(true)
  })
})

describe('valorHoy', () => {
  const arreglado = { arreglado: true, rinde: 0.75, costoAve: 10 }

  it('arreglado, a tu precio y menos lo de arreglarlos', () => {
    expect(valorHoy(100, 6, 60, 32, arreglado)).toBe(100 * (6 * 0.75 * 60 - 10))
  })

  // Sin precio del ciclo, el del mercado es el de la libra viva.
  it('sin precio del ciclo, en pie al precio del mercado', () => {
    expect(valorHoy(100, 6, undefined, 32, arreglado)).toBe(100 * 6 * 32)
  })

  it('sin peso no vale nada todavía', () => {
    expect(valorHoy(100, undefined, 60, 32, arreglado)).toBe(0)
  })
})

describe('arregladoContraPie', () => {
  // A 32 la libra en pie y 75 % de rinde, la libra arreglada tiene que pasar
  // de 42.67 para que arreglarlo deje más.
  it('dice a qué precio da lo mismo arreglarlo', () => {
    const c = arregladoContraPie(100, 6, 44, 32, { arreglado: true, rinde: 0.75, costoAve: 0 })
    expect(c.precioIgualLb).toBeCloseTo(32 / 0.75, 6)
    expect(c.enPie).toBe(19200)
    expect(c.arreglado).toBeCloseTo(19800, 6)
  })

  it('lo de arreglar cada pollo sube ese precio', () => {
    const sin = arregladoContraPie(100, 6, 60, 32, { arreglado: true, rinde: 0.75, costoAve: 0 })
    const con = arregladoContraPie(100, 6, 60, 32, { arreglado: true, rinde: 0.75, costoAve: 15 })
    expect(con.precioIgualLb).toBeCloseTo(sin.precioIgualLb + 15 / (6 * 0.75), 6)
    expect(sin.arreglado - con.arreglado).toBeCloseTo(1500, 6)
  })
})
