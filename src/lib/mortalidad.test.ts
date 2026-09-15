import { describe, expect, it } from 'vitest'
import { LIMITE_PRIMERA_SEMANA_PCT, resumenMortalidad } from './mortalidad'
import { lote, registro } from '../test/fixtures'

describe('resumenMortalidad', () => {
  it('sin registros no devuelve nada', () => {
    expect(resumenMortalidad(lote(), [])).toBeNull()
  })

  it('acumula bajas y descartes por separado', () => {
    const r = resumenMortalidad(lote(), [
      registro(1, { mortalidad: 5 }),
      registro(2, { mortalidad: 3, descarte: 2 }),
    ])!
    expect(r.bajas).toBe(8)
    expect(r.descartes).toBe(2)
    expect(r.pct).toBeCloseTo(2, 5)
    expect(r.vivas).toBe(490)
  })

  // El arranque delata al pollito y al recibo, no al manejo del resto del ciclo.
  it('mide la primera semana aparte', () => {
    const r = resumenMortalidad(lote(), [
      registro(1, { mortalidad: 4 }),
      registro(7, { mortalidad: 1 }),
      registro(8, { mortalidad: 20 }),
    ])!
    expect(r.primeraSemana).toBe(5)
    expect(r.primeraSemanaPct).toBeCloseTo(1, 5)
    expect(r.primeraSemanaPct).toBeLessThanOrEqual(LIMITE_PRIMERA_SEMANA_PCT)
  })

  it('encuentra el peor día contando descartes', () => {
    const r = resumenMortalidad(lote(), [
      registro(5, { mortalidad: 6 }),
      registro(9, { mortalidad: 4, descarte: 5 }),
    ])!
    expect(r.peorDia!.dia).toBe(9)
  })

  it('agrupa por semanas de siete días desde el día 1', () => {
    const r = resumenMortalidad(lote(), [
      registro(1, { mortalidad: 1 }),
      registro(7, { mortalidad: 1 }),
      registro(8, { mortalidad: 1 }),
      registro(14, { mortalidad: 1 }),
    ])!
    expect(r.semanas.map((s) => s.semana)).toEqual([1, 2])
    expect(r.semanas[0].muertes).toBe(2)
    expect(r.semanas[1].muertes).toBe(2)
  })

  it('las vivas de cada día bajan y nunca pasan a negativo', () => {
    const r = resumenMortalidad(lote({ cantidadInicial: 10 }), [
      registro(1, { mortalidad: 6 }),
      registro(2, { mortalidad: 6 }),
    ])!
    expect(r.dias[0].vivas).toBe(4)
    expect(r.dias[1].vivas).toBe(0)
  })
})
