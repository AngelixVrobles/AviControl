import { describe, expect, it } from 'vitest'
import { computeArranque, porIncubadora, reciboParaGuardar, tituloArranque } from './arranque'
import { computeMetrics } from './metrics'
import { erroresLote } from './lote'
import { resumenMortalidad } from './mortalidad'
import { lote, registro } from '../test/fixtures'

describe('computeArranque', () => {
  const l = lote({ cantidadInicial: 1000, muertosLlegada: 8, pesoLlegadaG: 40, incubadora: ' Pollos del Este ' })

  it('junta lo del recibo y la primera semana', () => {
    const a = computeArranque(
      l,
      [
        registro(1, { mortalidad: 3 }),
        registro(5, { mortalidad: 2, descarte: 1 }),
        registro(7, { pesoPromedio: 0.4 }),
        registro(8, { mortalidad: 9 }),
      ],
      10,
    )
    expect(a.incubadora).toBe('Pollos del Este')
    expect(a.doaPct).toBeCloseTo(0.8)
    // Las bajas del día 8 ya no son de la primera semana; se cuentan sobre los que entraron.
    expect(a.bajas7).toBe(6)
    expect(a.pct7).toBeCloseTo((6 / 992) * 100)
    expect(a.peso7G).toBe(181)
    expect(a.factor7).toBeCloseTo(181 / 40)
    expect(a.completa).toBe(true)
    expect(tituloArranque(a, 10)).toMatch(/^Buen arranque/)
  })

  it('toma el peso más cercano al día 7', () => {
    const a = computeArranque(l, [registro(6, { pesoPromedio: 0.35 }), registro(8, { pesoPromedio: 0.45 }), registro(7, { pesoPromedio: 0.4 })], 9)
    expect(a.diaPeso7).toBe(7)
  })

  it('sin peso al llegar no hay cuántas veces', () => {
    const a = computeArranque(lote(), [registro(7, { pesoPromedio: 0.4 })], 7)
    expect(a.factor7).toBeUndefined()
    expect(a.peso7G).toBe(181)
  })

  it('antes del día 7 la semana va en curso', () => {
    const a = computeArranque(l, [registro(2, { mortalidad: 30 })], 3)
    expect(a.completa).toBe(false)
    expect(tituloArranque(a, 3)).toBe('La primera semana va en el día 3')
  })
})

describe('los muertos en las cajas', () => {
  it('no están en el galpón ni son mortalidad de la granja', () => {
    const l = lote({ cantidadInicial: 1000, muertosLlegada: 10 })
    const m = computeMetrics(l, [registro(1, { mortalidad: 5 })], [], [])
    expect(m.avesVivas).toBe(985)
    expect(m.mortalidadPct).toBeCloseTo(0.5)
    expect(resumenMortalidad(l, [registro(1, { mortalidad: 5 })])!.vivas).toBe(985)
  })

  it('al corregir el ciclo no pueden ser más que los pollitos', () => {
    const lim = { salidas: 0 }
    expect(erroresLote({ fechaInicio: '2026-10-01', cantidad: 100, muertosLlegada: 100 }, lim).muertosLlegada).toBeDefined()
    expect(erroresLote({ fechaInicio: '2026-10-01', cantidad: 100, muertosLlegada: 5 }, { salidas: 98 }).cantidad).toBe(
      'Ya salieron 98 entre bajas, descartes y ventas, y 5 llegaron muertos.',
    )
  })

  it('se guardan limpios', () => {
    expect(reciboParaGuardar('  ', '40,5', '0')).toEqual({ incubadora: undefined, pesoLlegadaG: 40.5, muertosLlegada: undefined })
    expect(reciboParaGuardar('Cibao', '', '7')).toEqual({ incubadora: 'Cibao', pesoLlegadaG: undefined, muertosLlegada: 7 })
  })
})

describe('porIncubadora', () => {
  const a = (incubadora: string | undefined, doaPct: number, pct7: number) =>
    ({ ...computeArranque(lote(), [], 40), incubadora, doaPct, pct7 })

  it('agrupa sin importar mayúsculas y saca promedios', () => {
    const g = porIncubadora([
      { arranque: a('Cibao', 0.2, 0.8), mortalidadPct: 4, fca: 1.6 },
      { arranque: a('cibao', 0.4, 1.2), mortalidadPct: 6, fca: 1.7 },
      { arranque: a('Del Este', 1, 2), mortalidadPct: 8 },
      { arranque: a(undefined, 0, 0), mortalidadPct: 3 },
    ])
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ incubadora: 'Cibao', ciclos: 2, mortalidadPct: 5 })
    expect(g[0].doaPct).toBeCloseTo(0.3)
    expect(g[0].fca).toBeCloseTo(1.65)
    expect(g[1].fca).toBeUndefined()
  })
})
