import { describe, expect, it } from 'vitest'
import { construirContrastes, resultadoCiclo, snapshotCierre, type RealCiclo } from './cierre'
import { computeMetrics } from './metrics'
import { gasto, ingreso, lote, registro } from '../test/fixtures'

const real: RealCiclo = {
  diaVenta: 38,
  avesVendidas: 452,
  lbVendidas: 2622,
  pesoPromedioLb: 5.8,
  precioLogradoLb: 60,
  ingreso: 157320,
  ganancia: 35520,
  margenPct: 22.6,
  costoPorLb: 46.45,
  gananciaPorAve: 78.6,
}

describe('construirContrastes', () => {
  it('sin retrato del cierre no hay nada que comparar', () => {
    expect(construirContrastes(undefined, real)).toEqual([])
  })

  it('compara solo lo que la app llegó a proyectar', () => {
    const c = construirContrastes({ diaVenta: 38, pesoProyectadoLb: 5.73 }, real)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ etiqueta: 'Peso por ave', proyectado: 5.73, real: 5.8 })
  })

  it('dice en qué dirección es mejor cada indicador', () => {
    const c = construirContrastes(
      { diaVenta: 38, pesoProyectadoLb: 5.73, gananciaProyectada: 28420 },
      real,
    )
    expect(c.find((x) => x.etiqueta === 'Ganancia')!.mejorSi).toBe('mayor')
  })
})

describe('snapshotCierre', () => {
  it('congela lo que la app proyectaba antes de vender', () => {
    const l = lote()
    const registros = [registro(30, { pesoPromedio: 5.5 })]
    const m = computeMetrics(l, registros, [], [])
    const snap = snapshotCierre(m, null, 38)
    expect(snap.diaVenta).toBe(38)
    expect(snap.pesoProyectadoLb).toBe(m.pesoEstimadoLb)
    expect(snap.avesProyectadas).toBe(m.avesVivas)
  })
})

describe('resultadoCiclo', () => {
  const l = lote({
    estado: 'cerrado',
    costoInicial: 24000,
    cierre: { diaVenta: 38, pesoProyectadoLb: 5.73, gananciaProyectada: 28420 },
  })
  const gastos = [gasto({ categoria: 'alimento', monto: 76000, cantidadQq: 40 })]
  const ventas = [ingreso({ cantidad: 452, pesoLb: 2622, monto: 157320 })]
  const m = computeMetrics(l, [], gastos, ventas)

  it('sin ventas no hay resultado', () => {
    expect(resultadoCiclo(l, m, [])).toBeNull()
  })

  it('saca el peso por ave y el precio logrado de la venta', () => {
    const r = resultadoCiclo(l, m, ventas)!
    expect(r.avesVendidas).toBe(452)
    expect(r.pesoPromedioLb).toBeCloseTo(5.8, 2)
    expect(r.precioLogradoLb).toBeCloseTo(60, 2)
    expect(r.ganancia).toBe(157320 - 100000)
    expect(r.gananciaPorAve).toBeCloseTo(r.ganancia / 452, 5)
  })

  it('suma varias ventas del mismo ciclo', () => {
    const dos = [
      ingreso({ id: 1, cantidad: 200, pesoLb: 1100, monto: 66000 }),
      ingreso({ id: 2, cantidad: 252, pesoLb: 1522, monto: 91320 }),
    ]
    const met = computeMetrics(l, [], gastos, dos)
    const r = resultadoCiclo(l, met, dos)!
    expect(r.avesVendidas).toBe(452)
    expect(r.lbVendidas).toBe(2622)
    expect(r.ingreso).toBe(157320)
  })

  it('trae el contraste contra lo que decía la app', () => {
    const r = resultadoCiclo(l, m, ventas)!
    expect(r.contrastes.map((c) => c.etiqueta)).toContain('Ganancia')
    const g = r.contrastes.find((c) => c.etiqueta === 'Ganancia')!
    expect(g.proyectado).toBe(28420)
    expect(g.real).toBe(r.ganancia)
  })
})
