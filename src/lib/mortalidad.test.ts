import { describe, expect, it } from 'vitest'
import { LIMITE_PRIMERA_SEMANA_PCT, causasDelCiclo, resumenMortalidad } from './mortalidad'
import { ingreso, lote, registro } from '../test/fixtures'
import { computeMetrics } from './metrics'

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
    // La mortalidad es la misma de la tarjeta: solo las muertas. El descarte
    // va aparte.
    expect(r.pct).toBeCloseTo(1.6, 5)
    expect(r.pctDescarte).toBeCloseTo(0.4, 5)
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

describe('una sola mortalidad en toda la app', () => {
  it('la ficha y la tarjeta dicen lo mismo, con descartes', () => {
    const l = lote({ cantidadInicial: 1000 })
    const regs = [registro(10, { mortalidad: 20, descarte: 30 })]
    expect(resumenMortalidad(l, regs)!.pct).toBeCloseTo(computeMetrics(l, regs, [], []).mortalidadPct, 5)
  })

  it('las que quedan restan lo vendido', () => {
    const l = lote({ cantidadInicial: 1000 })
    const r = resumenMortalidad(l, [registro(29, { mortalidad: 50 })], [ingreso({ cantidad: 600, fecha: registro(20).fecha })])!
    expect(r.vivas).toBe(350)
  })

  it('lo que muere el día que llegaron cuenta en la primera semana', () => {
    const l = lote({ cantidadInicial: 1000 })
    const r = resumenMortalidad(l, [registro(0, { mortalidad: 12 })])!
    expect(r.primeraSemana).toBe(12)
  })
})

describe('de qué se murieron', () => {
  it('suma las muertes de cada causa y aparta las que no la tienen', () => {
    const c = causasDelCiclo([
      registro(30, { mortalidad: 40, causa: 'calor' }),
      registro(31, { mortalidad: 10, causa: 'calor' }),
      registro(25, { mortalidad: 10, causa: 'amontonadas' }),
      registro(10, { mortalidad: 5 }),
    ])
    expect(c).toEqual({
      causas: [
        { causa: 'calor', muertes: 50, pct: (50 / 60) * 100 },
        { causa: 'amontonadas', muertes: 10, pct: (10 / 60) * 100 },
      ],
      sinCausa: 5,
    })
  })

  it('sin ninguna causa anotada no hay nada que mostrar', () => {
    expect(causasDelCiclo([registro(3, { mortalidad: 4 })])).toBeNull()
  })
})
