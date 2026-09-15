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
})
