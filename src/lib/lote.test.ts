import { afterEach, describe, expect, it, vi } from 'vitest'
import { erroresLote, pesoObjetivoDe } from './lote'
import { lote } from '../test/fixtures'
import { memoriaStorage } from '../test/storage'

afterEach(() => vi.unstubAllGlobals())

describe('pesoObjetivoDe', () => {
  it('usa el peso del ciclo si tiene el suyo', () => {
    vi.stubGlobal('localStorage', memoriaStorage({ 'avicontrol.settings': '{"pesoObjetivoLb":6}' }))
    expect(pesoObjetivoDe(lote({ pesoObjetivoLb: 5 }))).toBe(5)
  })

  // Antes un ciclo sin peso propio se quedaba en 5.5 lb aunque en Ajustes
  // dijera otra cosa.
  it('sin peso propio toma el de Ajustes', () => {
    vi.stubGlobal('localStorage', memoriaStorage({ 'avicontrol.settings': '{"pesoObjetivoLb":6.2}' }))
    expect(pesoObjetivoDe(lote({ pesoObjetivoLb: undefined }))).toBe(6.2)
    expect(pesoObjetivoDe(lote({ pesoObjetivoLb: 0 }))).toBe(6.2)
  })

  it('sin Ajustes guardados queda el de siempre', () => {
    vi.stubGlobal('localStorage', memoriaStorage())
    expect(pesoObjetivoDe(lote({ pesoObjetivoLb: undefined }))).toBe(5.5)
  })
})

describe('erroresLote', () => {
  const limites = { primeraFecha: '2026-03-05', salidas: 40 }

  it('deja guardar lo que no rompe nada', () => {
    expect(erroresLote({ fechaInicio: '2026-03-01', cantidad: 1000 }, limites)).toEqual({})
    expect(erroresLote({ fechaInicio: '2026-03-05', cantidad: 40 }, limites)).toEqual({})
  })

  it('el inicio no puede quedar después de lo ya anotado', () => {
    const e = erroresLote({ fechaInicio: '2026-03-06', cantidad: 1000 }, limites)
    expect(e.fechaInicio).toMatch(/desde/)
  })

  it('ni después del cierre', () => {
    const e = erroresLote(
      { fechaInicio: '2026-05-01', cantidad: 1000 },
      { salidas: 0, fechaCierre: '2026-04-20' },
    )
    expect(e.fechaInicio).toMatch(/cerró/)
  })

  it('no puede haber menos pollitos de los que ya salieron', () => {
    expect(erroresLote({ fechaInicio: '2026-03-01', cantidad: 39 }, limites).cantidad).toMatch(/40/)
    expect(erroresLote({ fechaInicio: '2026-03-01', cantidad: 0 }, limites).cantidad).toBeDefined()
    expect(erroresLote({ fechaInicio: '', cantidad: 100 }, limites).fechaInicio).toBeDefined()
  })
})
