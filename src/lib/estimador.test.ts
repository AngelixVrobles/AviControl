import { describe, expect, it } from 'vitest'
import {
  cicloAprendido,
  diaParaPesoEstimado,
  estimarPeso,
  margenRelativo,
  perfilDeGranja,
  type CicloAprendido,
} from './estimador'
import { pesoEstandarLb } from './standards'
import { ingreso, lote, registro } from '../test/fixtures'

const inicio = '2026-09-01'
const enDia = (dia: number) => {
  const d = new Date(`${inicio}T12:00:00`)
  d.setDate(d.getDate() + dia)
  return d.toISOString().slice(0, 10)
}
const l = lote({ fechaInicio: inicio })
const pesado = (dia: number, pesoPromedio: number) => registro(dia, { fecha: enDia(dia), pesoPromedio })

// La pollada que cerró: vendió a los 42 días, a 5.49 lb, el 76 % del Cobb.
const anterior: CicloAprendido = { factor: 5.49 / pesoEstandarLb(42), dia: 42, aves: 902, fechaCierre: '2026-08-15' }

describe('lo que aprende de las polladas cerradas', () => {
  it('a qué parte del Cobb vendió, por lo que pesaron las ventas', () => {
    const cerrado = lote({ fechaInicio: inicio, estado: 'cerrado', fechaCierre: enDia(42) })
    const c = cicloAprendido(cerrado, [ingreso({ cantidad: 902, pesoLb: 4949, monto: 195000, fecha: enDia(42) })])!
    expect(c.factor).toBeCloseTo(4949 / 902 / pesoEstandarLb(42), 6)
    expect(c.dia).toBe(42)
    // Sin ventas pesadas, o con un peso que no puede ser, no enseña nada.
    expect(cicloAprendido(cerrado, [ingreso({ cantidad: 902, monto: 195000, fecha: enDia(42) })])).toBeUndefined()
    expect(cicloAprendido(cerrado, [ingreso({ cantidad: 902, pesoLb: 90, monto: 1, fecha: enDia(42) })])).toBeUndefined()
  })

  it('las polladas recientes pesan más, y con pocas el margen es el de cualquier granja', () => {
    const p = perfilDeGranja([anterior])!
    expect(p.factor).toBeCloseTo(5.49 / pesoEstandarLb(42), 6)
    expect(p.dispersion).toBeCloseTo(Math.sqrt((2 * 0.01) / 3), 3)
    const dos = perfilDeGranja([anterior, { ...anterior, factor: 0.95, fechaCierre: '2026-05-01' }])!
    expect(dos.factor).toBeGreaterThan(anterior.factor)
    expect(dos.factor).toBeLessThan((anterior.factor + 0.95) / 2)
    expect(perfilDeGranja([])).toBeUndefined()
  })
})

describe('el peso que van a tener', () => {
  // A los 28 días pesaron 11 % arriba del Cobb, en unas 10 aves.
  const registros = [pesado(28, pesoEstandarLb(28) * 1.11)]

  it('sin polladas cerradas, sigue el último pesaje como antes', () => {
    const e = estimarPeso(l, registros)!
    expect(e.conHistoria).toBe(false)
    expect(e.pesoEn(42)).toBeCloseTo(pesoEstandarLb(42) * 1.11, 6)
    // Pero el margen crece con los días que pasan desde el pesaje.
    expect(margenRelativo(e, 42)).toBeGreaterThan(margenRelativo(e, 28))
  })

  it('con lo que logra la granja, no estira el pesaje dos semanas: se acerca a lo de verdad', () => {
    const e = estimarPeso(l, registros, [], perfilDeGranja([anterior]))!
    expect(e.conHistoria).toBe(true)
    const peso = e.pesoEn(42)
    // Antes decía 7.76 lb; se vendieron a 5.49.
    expect(peso).toBeLessThan(6.5)
    expect(peso).toBeGreaterThan(5.5)
    const [bajo, alto] = e.rangoEn(42)
    expect(bajo).toBeLessThanOrEqual(5.6)
    expect(alto).toBeGreaterThan(peso)
  })

  it('con otro pesaje más cerca de la venta, le cree más a ese', () => {
    const conDos = estimarPeso(l, [...registros, pesado(38, pesoEstandarLb(38) * 0.8)], [], perfilDeGranja([anterior]))!
    expect(conDos.factorEn(42)).toBeCloseTo(0.8, 1)
    expect(margenRelativo(conDos, 42)).toBeLessThan(
      margenRelativo(estimarPeso(l, registros, [], perfilDeGranja([anterior]))!, 42),
    )
  })

  it('un pesaje de muchas aves pesa más que uno de pocas', () => {
    const pocas = [{ id: 1, loteId: 1, fecha: enDia(28), pesos: [4.3, 4.4, 4.5], creado: 0 }]
    const muchas = [
      { id: 1, loteId: 1, fecha: enDia(28), pesos: Array.from({ length: 60 }, (_, i) => 4.2 + (i % 5) * 0.1), creado: 0 },
    ]
    const perfil = perfilDeGranja([anterior])
    const conPocas = estimarPeso(l, [pesado(28, 4.4)], pocas, perfil)!
    const conMuchas = estimarPeso(l, [pesado(28, 4.4)], muchas, perfil)!
    expect(Math.abs(conMuchas.pesoEn(28) - 4.4)).toBeLessThan(Math.abs(conPocas.pesoEn(28) - 4.4))
  })

  it('dice cuánto se afina si se pesan más aves cerca de la venta', () => {
    const e = estimarPeso(l, registros, [], perfilDeGranja([anterior]))!
    const ahora = margenRelativo(e, 42)
    const pesando43 = e.margenSiPesa(43, 39, 42)
    expect(pesando43).toBeLessThan(ahora * 0.65)
    expect(e.margenSiPesa(10, 39, 42)).toBeGreaterThan(pesando43)
  })

  it('los pollos no bajan de peso después del último pesaje', () => {
    const e = estimarPeso(l, registros, [], perfilDeGranja([anterior]))!
    for (let d = 28; d < 50; d++) expect(e.pesoEn(d + 1)).toBeGreaterThanOrEqual(e.pesoEn(d))
  })

  it('el día en que llegan al peso de venta sale del camino estimado', () => {
    const sin = estimarPeso(l, registros)!
    const con = estimarPeso(l, registros, [], perfilDeGranja([anterior]))!
    expect(diaParaPesoEstimado(con, 5.5)).toBeGreaterThan(diaParaPesoEstimado(sin, 5.5))
  })

  it('sin pesajes no estima', () => {
    expect(estimarPeso(l, [registro(20)])).toBeUndefined()
  })
})
