import { describe, expect, it } from 'vitest'
import { computeMetrics } from './metrics'
import { gasto, hace, ingreso, lote, registro } from '../test/fixtures'
import { pesoEstandarLb } from './standards'

const dias = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('computeMetrics', () => {
  it('cuenta bajas, descartes y vendidas al sacar las aves vivas', () => {
    const m = computeMetrics(
      lote(),
      [registro(1, { mortalidad: 5 }), registro(2, { descarte: 3 })],
      [],
      [ingreso({ tipo: 'aves', cantidad: 100 })],
    )
    expect(m.avesVivas).toBe(392)
    expect(m.bajas).toBe(8)
    // El descarte no es mortalidad: son aves que se sacan, no que se mueren.
    expect(m.mortalidadPct).toBeCloseTo(1, 5)
  })

  it('un ciclo cerrado congela los días en la fecha de cierre', () => {
    const abierto = computeMetrics(lote(), [], [], [])
    const cerrado = computeMetrics(
      lote({ estado: 'cerrado', fechaCierre: hace(10) }),
      [],
      [],
      [],
    )
    expect(abierto.dias).toBe(30)
    expect(cerrado.dias).toBe(20)
  })

  // Un peso corrupto pasaba el filtro porque `typeof NaN === 'number'`, se
  // volvía el último pesaje y arrastraba todas las proyecciones a NaN.
  it('ignora los pesos que no son números válidos', () => {
    const m = computeMetrics(
      lote(),
      [registro(20, { pesoPromedio: 2.3 }), registro(21, { pesoPromedio: NaN })],
      [],
      [],
    )
    expect(m.pesoPromedioLb).toBe(2.3)
    expect(Number.isFinite(m.factorCurva)).toBe(true)
    expect(Number.isFinite(m.diaObjetivo)).toBe(true)
  })

  it('escala la curva al rendimiento real del lote', () => {
    const m = computeMetrics(
      lote(),
      [registro(21, { pesoPromedio: pesoEstandarLb(21) * 0.9 })],
      [],
      [],
    )
    expect(m.factorCurva).toBeCloseTo(0.9, 3)
  })

  // Con un pesaje viejo, el alimento de los días siguientes se dividía entre la
  // biomasa de entonces y el FCA se disparaba sin que pasara nada.
  describe('peso proyectado a hoy', () => {
    const registros = [
      ...dias(30).map((d) => registro(d, { alimentoLb: 100 })),
      registro(21, { pesoPromedio: pesoEstandarLb(21), alimentoLb: 100 }),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))

    it('proyecta el peso del último pesaje al día de hoy', () => {
      const m = computeMetrics(lote(), registros, [], [])
      expect(m.diasDesdePeso).toBe(9)
      expect(m.pesoPromedioLb).toBeCloseTo(pesoEstandarLb(21), 2)
      expect(m.pesoEstimadoLb).toBeCloseTo(pesoEstandarLb(30), 2)
    })

    it('el FCA no se dispara por un pesaje viejo', () => {
      const m = computeMetrics(lote(), registros, [], [])
      const conPesoViejo = 3000 / (m.avesVivas * m.pesoPromedioLb!)
      expect(m.fca!).toBeLessThan(conPesoViejo)
    })

    it('nunca estima un peso menor al medido', () => {
      const m = computeMetrics(lote(), [registro(30, { pesoPromedio: 9 })], [], [])
      expect(m.pesoEstimadoLb).toBe(9)
    })
  })

  it('suma costos e ingresos y saca el margen', () => {
    const m = computeMetrics(
      lote({ costoInicial: 24000 }),
      [],
      [gasto({ monto: 76000, categoria: 'alimento' })],
      [ingreso({ monto: 150000, cantidad: 450, pesoLb: 2500 })],
    )
    expect(m.costos).toBe(100000)
    expect(m.ingresos).toBe(150000)
    expect(m.ganancia).toBe(50000)
    expect(m.margenPct).toBeCloseTo(33.33, 1)
  })

  it('sin pesajes no inventa peso ni proyección', () => {
    const m = computeMetrics(lote(), [registro(1, { alimentoLb: 50 })], [], [])
    expect(m.pesoPromedioLb).toBeUndefined()
    expect(m.pesoEstimadoLb).toBeUndefined()
    expect(m.fca).toBeUndefined()
    expect(m.factorCurva).toBe(1)
  })

  // El caso del productor que anota la mortalidad pero no el alimento: la app
  // mostraba «Conversión 0.00», que se lee como un lote perfecto.
  it('sin alimento no hay conversión, aunque haya peso', () => {
    const m = computeMetrics(
      lote(),
      [registro(10), registro(14, { pesoPromedio: pesoEstandarLb(14) })],
      [],
      [],
    )
    expect(m.alimentoTotalLb).toBe(0)
    expect(m.fca).toBeUndefined()
    expect(m.iep).toBeUndefined()
  })

  it('el conteo de sacos llena el alimento y la conversión', () => {
    const l = lote({ conteosAlimento: [{ fecha: hace(0), qq: 30 }] })
    const m = computeMetrics(
      l,
      [registro(28, { pesoPromedio: pesoEstandarLb(28) })],
      [gasto({ categoria: 'alimento', monto: 100000, cantidadQq: 60 })],
      [],
    )
    expect(m.alimentoTotalLb).toBeCloseTo(3000, 5)
    expect(m.diaAlimento).toBe(30)
    expect(m.fca).toBeCloseTo(3000 / (500 * pesoEstandarLb(30)), 5)
  })

  // Contar los sacos el día 14 y no volver a anotar: el día 20 el alimento sigue
  // siendo el de hasta el 14, y dividirlo entre el peso del 20 daba una
  // conversión mejor que la real.
  it('mide la conversión al último día con dato de alimento', () => {
    const l = lote({ conteosAlimento: [{ fecha: hace(16), qq: 10 }] })
    const m = computeMetrics(
      l,
      [registro(14, { pesoPromedio: pesoEstandarLb(14) })],
      [gasto({ categoria: 'alimento', monto: 1, cantidadQq: 20 })],
      [],
    )
    expect(m.diaAlimento).toBe(14)
    expect(m.fca).toBeCloseTo(1000 / (500 * pesoEstandarLb(14)), 5)
    expect(m.pesoEstimadoLb).toBeCloseTo(pesoEstandarLb(30), 5)
  })
})
