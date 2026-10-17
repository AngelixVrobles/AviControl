import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorFechaDelCiclo, errorFechaFutura, errorNegativo, erroresLote, pesoObjetivoDe, topeDelCiclo } from './lote'
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

  // Un ciclo que empezaba el mes que viene salía en el día −30 y sin avisos.
  it('no puede empezar en una fecha que todavía no llega', () => {
    expect(erroresLote({ fechaInicio: '2099-01-01', cantidad: 1000 }, { salidas: 0 }).fechaInicio).toMatch(
      /todavía no llega/,
    )
  })
})

describe('errorNegativo', () => {
  it('avisa con un número negativo y deja pasar lo demás', () => {
    expect(errorNegativo('-45')).toMatch(/negativo/)
    expect(errorNegativo('0')).toBeUndefined()
    expect(errorNegativo('')).toBeUndefined()
    expect(errorNegativo('12.5')).toBeUndefined()
  })
})

describe('fechas del ciclo', () => {
  const hoy = '2026-10-17'
  const activo = { fechaInicio: '2026-09-20' }
  const cerrado = { fechaInicio: '2026-08-01', fechaCierre: '2026-09-12' }

  it('acepta del día de llegada a hoy', () => {
    expect(errorFechaDelCiclo('2026-09-20', activo, hoy)).toBeUndefined()
    expect(errorFechaDelCiclo(hoy, activo, hoy)).toBeUndefined()
  })

  it('no acepta antes de que llegaran los pollitos', () => {
    expect(errorFechaDelCiclo('2026-09-19', activo, hoy)).toMatch(/antes de que llegaran/)
  })

  // Un día anotado por error en el mes que viene callaba el aviso de días sin
  // registro hasta esa fecha.
  it('no acepta una fecha que todavía no llega', () => {
    expect(errorFechaDelCiclo('2026-11-17', activo, hoy)).toMatch(/todavía no llega/)
  })

  it('en un ciclo cerrado, nada después del cierre', () => {
    expect(topeDelCiclo(cerrado, hoy)).toBe('2026-09-12')
    expect(errorFechaDelCiclo('2026-09-13', cerrado, hoy)).toMatch(/cerró/)
    expect(errorFechaDelCiclo('2026-09-12', cerrado, hoy)).toBeUndefined()
  })

  it('una compra puede ser de antes del ciclo, pero no del futuro', () => {
    expect(errorFechaFutura('2026-01-01', hoy)).toBeUndefined()
    expect(errorFechaFutura('2026-10-18', hoy)).toMatch(/todavía no llega/)
    expect(errorFechaFutura('', hoy)).toBeDefined()
  })
})
